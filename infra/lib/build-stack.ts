import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import { Construct } from "constructs";

// Fixed ECR repo names so the AppStack can import them by name.
export const FRONTEND_REPO = "moneyball-frontend";
export const BACKEND_REPO = "moneyball-backend";

interface BuildStackProps extends cdk.StackProps {
  domainName: string;
}

/**
 * Builds the container images IN AWS via CodeBuild and pushes them to ECR.
 * Local uploads of the (multi-GB) images to ECR are unreliable, so we ship only
 * the small source to S3 and let CodeBuild build + push over AWS's network.
 * This is also the foundation for the CI/CD pipeline.
 */
export class BuildStack extends cdk.Stack {
  readonly sourceBucket: s3.Bucket;
  readonly project: codebuild.Project;

  constructor(scope: Construct, id: string, props: BuildStackProps) {
    super(scope, id, props);

    const frontendRepo = new ecr.Repository(this, "FrontendRepo", {
      repositoryName: FRONTEND_REPO,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });
    const backendRepo = new ecr.Repository(this, "BackendRepo", {
      repositoryName: BACKEND_REPO,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // Holds the uploaded source zip that CodeBuild builds from.
    this.sourceBucket = new s3.Bucket(this, "SourceBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const registry = `${this.account}.dkr.ecr.${this.region}.amazonaws.com`;

    this.project = new codebuild.Project(this, "ImageBuild", {
      projectName: "moneyball-image-build",
      source: codebuild.Source.s3({ bucket: this.sourceBucket, path: "source.zip" }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // needed to run Docker builds
      },
      environmentVariables: {
        REGISTRY: { value: registry },
        FRONTEND_REPO: { value: frontendRepo.repositoryUri },
        BACKEND_REPO: { value: backendRepo.repositoryUri },
        // Baked into the frontend bundle at build time.
        NEXT_PUBLIC_BACKEND_WS_URL: { value: `wss://api.${props.domainName}` },
        IMAGE_TAG: { value: "latest" }, // override per build with --environment-variables-override
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REGISTRY",
            ],
          },
          build: {
            commands: [
              "docker build -f backend/dockerfile -t $BACKEND_REPO:$IMAGE_TAG backend",
              "docker build -f frontend/dockerfile --build-arg NEXT_PUBLIC_BACKEND_WS_URL=$NEXT_PUBLIC_BACKEND_WS_URL -t $FRONTEND_REPO:$IMAGE_TAG frontend",
            ],
          },
          post_build: {
            commands: [
              "docker push $BACKEND_REPO:$IMAGE_TAG",
              "docker push $FRONTEND_REPO:$IMAGE_TAG",
            ],
          },
        },
      }),
      timeout: cdk.Duration.minutes(30),
    });

    frontendRepo.grantPullPush(this.project);
    backendRepo.grantPullPush(this.project);

    new cdk.CfnOutput(this, "SourceBucketName", { value: this.sourceBucket.bucketName });
    new cdk.CfnOutput(this, "ProjectName", { value: this.project.projectName });
  }
}
