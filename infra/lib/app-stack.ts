import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as rds from "aws-cdk-lib/aws-rds";
import * as logs from "aws-cdk-lib/aws-logs";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { FRONTEND_PORT, BACKEND_PORT } from "./network-stack";
import { FRONTEND_REPO, BACKEND_REPO } from "./build-stack";

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  albSecurityGroup: ec2.SecurityGroup;
  serviceSecurityGroup: ec2.SecurityGroup;
  dbInstance: rds.DatabaseInstance;
  domainName: string;
  hostedZoneId: string;
  imageTag: string;
}

/**
 * The running app: ECS Fargate services for frontend + backend behind one ALB,
 * with ACM/HTTPS and Route 53 records. Also defines a one-off migration task and
 * the EventBridge-driven settlement backstop.
 */
export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { vpc, albSecurityGroup, serviceSecurityGroup, dbInstance, domainName, hostedZoneId, imageTag } = props;
    const apiDomain = `api.${domainName}`;
    const dbSecret = dbInstance.secret!;

    // --- DNS + TLS ---------------------------------------------------------
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId,
      zoneName: domainName,
    });
    const certificate = new acm.Certificate(this, "Cert", {
      domainName,
      subjectAlternativeNames: [apiDomain],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // --- App secrets -------------------------------------------------------
    // NextAuth signing secret (used as both AUTH_SECRET and NEXTAUTH_SECRET).
    const authSecret = new secretsmanager.Secret(this, "AuthSecret", {
      description: "money-ball NextAuth secret",
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    // Shared secret guarding POST /api/settle.
    const settleSecret = new secretsmanager.Secret(this, "SettleSecret", {
      description: "money-ball settlement endpoint secret",
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    // Placeholder for the W&B key — update its value after deploy (the backend
    // falls back to placeholder odds until a valid key is set).
    const wandbSecret = new secretsmanager.Secret(this, "WandbApiKey", {
      description: "money-ball W&B API key (set the real value after deploy)",
      secretStringValue: cdk.SecretValue.unsafePlainText("replace-me"),
    });

    // DB connection fields injected from the RDS-managed secret. The app composes
    // DATABASE_URL from these at container start (ECS can't template a URL).
    const dbSecretEnv = {
      DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
      DB_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
      DB_USER: ecs.Secret.fromSecretsManager(dbSecret, "username"),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
      DB_NAME: ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
    };
    // RDS enforces SSL (rds.force_ssl=1). The pg driver adapter doesn't enable
    // TLS by default, so request it via sslmode=no-verify (encrypt; don't verify
    // the RDS CA — avoids bundling the cert for this faux app).
    const composeDatabaseUrl =
      'export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=no-verify"';

    // --- Container images (built in AWS by the BuildStack's CodeBuild) ------
    // Imported by name; CodeBuild pushes them to these repos. fromEcrRepository
    // also grants the task execution role pull access automatically.
    const frontendRepo = ecr.Repository.fromRepositoryName(this, "FeRepo", FRONTEND_REPO);
    const backendRepo = ecr.Repository.fromRepositoryName(this, "BeRepo", BACKEND_REPO);
    const frontendImage = ecs.ContainerImage.fromEcrRepository(frontendRepo, imageTag);
    const backendImage = ecs.ContainerImage.fromEcrRepository(backendRepo, imageTag);

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });
    const logRetention = logs.RetentionDays.ONE_WEEK;

    // --- Backend service ---------------------------------------------------
    const backendTask = new ecs.FargateTaskDefinition(this, "BackendTask", {
      cpu: 512,
      memoryLimitMiB: 2048, // model (sklearn/xgboost/pandas) lives in memory
    });
    backendTask.addContainer("api", {
      image: backendImage,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "backend", logRetention }),
      environment: { APP_TIMEZONE: "America/New_York" },
      secrets: { WANDB_API_KEY: ecs.Secret.fromSecretsManager(wandbSecret) },
      portMappings: [{ containerPort: BACKEND_PORT }],
    });
    const backendService = new ecs.FargateService(this, "BackendService", {
      cluster,
      taskDefinition: backendTask,
      desiredCount: 1,
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true, // outbound to MLB API / W&B without a NAT gateway
      healthCheckGracePeriod: cdk.Duration.seconds(120), // model load on boot
      minHealthyPercent: 100, // keep one task serving during deploys
      circuitBreaker: { rollback: true }, // fail fast + auto-rollback bad deploys
    });

    // --- Frontend service --------------------------------------------------
    const frontendTask = new ecs.FargateTaskDefinition(this, "FrontendTask", {
      cpu: 256,
      memoryLimitMiB: 512,
    });
    frontendTask.addContainer("web", {
      image: frontendImage,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "frontend", logRetention }),
      // Compose DATABASE_URL from the injected DB fields, then start Next.
      command: ["sh", "-lc", `${composeDatabaseUrl}; exec pnpm start`],
      environment: {
        NODE_ENV: "production",
        NEXTAUTH_URL: `https://${domainName}`,
        FAST_API_BACKEND_URL: `https://${apiDomain}`,
      },
      secrets: {
        ...dbSecretEnv,
        AUTH_SECRET: ecs.Secret.fromSecretsManager(authSecret),
        NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(authSecret),
        SETTLE_SECRET: ecs.Secret.fromSecretsManager(settleSecret),
      },
      portMappings: [{ containerPort: FRONTEND_PORT }],
    });
    const frontendService = new ecs.FargateService(this, "FrontendService", {
      cluster,
      taskDefinition: frontendTask,
      desiredCount: 1,
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      minHealthyPercent: 100,
      circuitBreaker: { rollback: true },
    });

    // --- One-off migration task (run by the pipeline / manually before first use) ---
    const migrateTask = new ecs.FargateTaskDefinition(this, "MigrateTask", {
      cpu: 256,
      memoryLimitMiB: 512,
    });
    migrateTask.addContainer("migrate", {
      image: frontendImage, // reuses the frontend image (has the Prisma CLI + schema)
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "migrate", logRetention }),
      command: ["sh", "-lc", `${composeDatabaseUrl}; exec pnpm prisma migrate deploy`],
      secrets: { ...dbSecretEnv },
    });

    // --- Load balancer -----------------------------------------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      // WebSocket connections can be idle between pitches; keep them alive.
      idleTimeout: cdk.Duration.seconds(4000),
    });

    // HTTP :80 -> redirect to HTTPS (required anyway: .app forces HTTPS).
    alb.addListener("Http", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // HTTPS :443 -> host-based routing to the two services.
    const https = alb.addListener("Https", {
      port: 443,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not found",
      }),
    });
    https.addTargets("Frontend", {
      priority: 20,
      conditions: [elbv2.ListenerCondition.hostHeaders([domainName])],
      port: FRONTEND_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [frontendService.loadBalancerTarget({ containerName: "web", containerPort: FRONTEND_PORT })],
      healthCheck: { path: "/api/health", healthyHttpCodes: "200" },
      deregistrationDelay: cdk.Duration.seconds(15),
    });
    https.addTargets("Backend", {
      priority: 10,
      conditions: [elbv2.ListenerCondition.hostHeaders([apiDomain])],
      port: BACKEND_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backendService.loadBalancerTarget({ containerName: "api", containerPort: BACKEND_PORT })],
      healthCheck: { path: "/health", healthyHttpCodes: "200" },
      deregistrationDelay: cdk.Duration.seconds(15),
    });

    // --- DNS records -> ALB ------------------------------------------------
    const albTarget = route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(alb));
    new route53.ARecord(this, "ApexRecord", { zone: hostedZone, target: albTarget });
    new route53.ARecord(this, "ApiRecord", { zone: hostedZone, recordName: "api", target: albTarget });

    // --- Settlement backstop: EventBridge -> POST /api/settle --------------
    const settleConnection = new events.Connection(this, "SettleConnection", {
      authorization: events.Authorization.apiKey("x-settle-secret", settleSecret.secretValue),
    });
    const settleDestination = new events.ApiDestination(this, "SettleDestination", {
      connection: settleConnection,
      endpoint: `https://${domainName}/api/settle`,
      httpMethod: events.HttpMethod.POST,
    });
    new events.Rule(this, "SettleSchedule", {
      description: "Periodic settlement backstop",
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new eventsTargets.ApiDestination(settleDestination)],
    });

    // --- Outputs -----------------------------------------------------------
    new cdk.CfnOutput(this, "AppUrl", { value: `https://${domainName}` });
    new cdk.CfnOutput(this, "ApiUrl", { value: `https://${apiDomain}` });
    new cdk.CfnOutput(this, "AlbDnsName", { value: alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, "WandbSecretArn", { value: wandbSecret.secretArn });
    new cdk.CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new cdk.CfnOutput(this, "MigrateTaskArn", { value: migrateTask.taskDefinitionArn });
    new cdk.CfnOutput(this, "ServiceSubnets", {
      value: vpc.publicSubnets.map((s) => s.subnetId).join(","),
    });
    new cdk.CfnOutput(this, "ServiceSecurityGroupId", { value: serviceSecurityGroup.securityGroupId });
  }
}
