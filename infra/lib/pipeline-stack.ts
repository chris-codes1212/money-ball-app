import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as cpactions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { FRONTEND_REPO, BACKEND_REPO } from "./build-stack";

interface PipelineStackProps extends cdk.StackProps {
  domainName: string;
  connectionArn: string;
  owner: string;
  repo: string;
  branch: string;
}

/**
 * CI/CD: on every push to the tracked branch, build both images (tagged with the
 * commit SHA) and push to ECR, then `cdk deploy` the App stack at that tag so ECS
 * rolls out the new images, and run the DB migration task.
 *
 * Source -> Build (CodeBuild, Docker) -> Deploy (CodeBuild, cdk deploy + migrate)
 */
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const { domainName, connectionArn, owner, repo, branch } = props;
    const registry = `${this.account}.dkr.ecr.${this.region}.amazonaws.com`;
    const frontendRepoUri = `${registry}/${FRONTEND_REPO}`;
    const backendRepoUri = `${registry}/${BACKEND_REPO}`;

    const frontendRepo = ecr.Repository.fromRepositoryName(this, "FeRepo", FRONTEND_REPO);
    const backendRepo = ecr.Repository.fromRepositoryName(this, "BeRepo", BACKEND_REPO);

    const sourceOutput = new codepipeline.Artifact("Source");

    // --- Build: docker build + push both images, tagged with the commit SHA ---
    const buildProject = new codebuild.PipelineProject(this, "Build", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.LARGE,
        privileged: true, // Docker
      },
      environmentVariables: {
        REGISTRY: { value: registry },
        FRONTEND_REPO_URI: { value: frontendRepoUri },
        BACKEND_REPO_URI: { value: backendRepoUri },
        NEXT_PUBLIC_BACKEND_WS_URL: { value: `wss://api.${domainName}` },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        env: {
          // Exposed to later pipeline stages as #{BuildVars.IMAGE_TAG}.
          "exported-variables": ["IMAGE_TAG"],
        },
        phases: {
          pre_build: {
            commands: [
              // POSIX sh (dash) — no bash substring expansion, so use cut.
              'export IMAGE_TAG=$(echo "$CODEBUILD_RESOLVED_SOURCE_VERSION" | cut -c1-12)',
              "echo Building tag $IMAGE_TAG",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REGISTRY",
            ],
          },
          build: {
            commands: [
              "docker build -f backend/dockerfile -t $BACKEND_REPO_URI:$IMAGE_TAG backend",
              "docker build -f frontend/dockerfile --build-arg NEXT_PUBLIC_BACKEND_WS_URL=$NEXT_PUBLIC_BACKEND_WS_URL -t $FRONTEND_REPO_URI:$IMAGE_TAG frontend",
            ],
          },
          post_build: {
            commands: [
              "docker push $BACKEND_REPO_URI:$IMAGE_TAG",
              "docker push $FRONTEND_REPO_URI:$IMAGE_TAG",
            ],
          },
        },
      }),
      timeout: cdk.Duration.minutes(30),
    });
    frontendRepo.grantPullPush(buildProject);
    backendRepo.grantPullPush(buildProject);

    // --- Deploy: cdk deploy the App stack at the new tag, then run migrations ---
    const deployProject = new codebuild.PipelineProject(this, "Deploy", {
      environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_7_0 },
      environmentVariables: {
        // Bound to the build stage's exported variable at action level (below).
        IMAGE_TAG: { value: "latest" },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: { commands: ["cd infra", "npm ci"] },
          build: {
            commands: [
              // Roll the App stack to the freshly built image tag.
              "npx cdk deploy MoneyBallApp -c imageTag=$IMAGE_TAG --require-approval never",
            ],
          },
          post_build: {
            commands: [
              // Apply DB migrations via the one-off task (now on the new image).
              "cd ..",
              "STK=MoneyBallApp",
              "out() { aws cloudformation describe-stacks --stack-name $STK --query \"Stacks[0].Outputs[?OutputKey=='$1'].OutputValue\" --output text; }",
              "CLUSTER=$(out ClusterName); TD=$(out MigrateTaskArn); SUBNETS=$(out ServiceSubnets); SG=$(out ServiceSecurityGroupId)",
              'TASK=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$TD" --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" --query "tasks[0].taskArn" --output text)',
              'aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK"',
              'EXIT=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" --query "tasks[0].containers[0].exitCode" --output text)',
              'echo "migration exit code: $EXIT"; test "$EXIT" = "0"',
            ],
          },
        },
      }),
      timeout: cdk.Duration.minutes(30),
    });

    // cdk deploy assumes the CDK bootstrap roles; the migrate step needs ECS perms.
    deployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );
    deployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecs:RunTask",
          "ecs:DescribeTasks",
          "cloudformation:DescribeStacks",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeVpcs",
        ],
        resources: ["*"],
      }),
    );
    deployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [`arn:aws:iam::${this.account}:role/MoneyBallApp-*`],
      }),
    );

    // --- Pipeline wiring ---------------------------------------------------
    const buildOutput = new codepipeline.Artifact("Build");
    const buildAction = new cpactions.CodeBuildAction({
      actionName: "BuildImages",
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
      variablesNamespace: "BuildVars",
    });

    new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "money-ball-pipeline",
      pipelineType: codepipeline.PipelineType.V2,
      stages: [
        {
          stageName: "Source",
          actions: [
            new cpactions.CodeStarConnectionsSourceAction({
              actionName: "GitHub",
              owner,
              repo,
              branch,
              connectionArn,
              output: sourceOutput,
              triggerOnPush: true,
            }),
          ],
        },
        { stageName: "Build", actions: [buildAction] },
        {
          stageName: "Deploy",
          actions: [
            new cpactions.CodeBuildAction({
              actionName: "Deploy",
              project: deployProject,
              input: sourceOutput,
              environmentVariables: {
                IMAGE_TAG: { value: buildAction.variable("IMAGE_TAG") },
              },
            }),
          ],
        },
      ],
    });

    new cdk.CfnOutput(this, "PipelineName", { value: "money-ball-pipeline" });
  }
}
