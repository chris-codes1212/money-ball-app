#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { AppStack } from "../lib/app-stack";
import { BuildStack } from "../lib/build-stack";
import { PipelineStack } from "../lib/pipeline-stack";

const app = new cdk.App();

// Deploy target. CDK_DEFAULT_* come from the active AWS CLI profile; region
// falls back to us-east-1 (where this account is configured).
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

// Domain + hosted zone for ACM/DNS (defaults live in cdk.json context).
const domainName: string | undefined = app.node.tryGetContext("domainName");
const hostedZoneId: string | undefined = app.node.tryGetContext("hostedZoneId");
// Image tag the App services pull from ECR (CodeBuild pushes this tag).
const imageTag: string = app.node.tryGetContext("imageTag") ?? "latest";

const network = new NetworkStack(app, "MoneyBallNetwork", { env });

// ECR repos + CodeBuild image builder (needs the domain for the WS build arg).
if (domainName) {
  new BuildStack(app, "MoneyBallBuild", { env, domainName });
}

const data = new DataStack(app, "MoneyBallData", {
  env,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
});

// AppStack needs the domain (the frontend image bakes in wss://api.<domain>).
if (domainName && hostedZoneId) {
  new AppStack(app, "MoneyBallApp", {
    env,
    vpc: network.vpc,
    albSecurityGroup: network.albSecurityGroup,
    serviceSecurityGroup: network.serviceSecurityGroup,
    dbInstance: data.instance,
    domainName,
    hostedZoneId,
    imageTag,
  });
} else {
  cdk.Annotations.of(app).addWarning(
    "domainName/hostedZoneId not set — skipping AppStack. Set them in cdk.json context.",
  );
}

// CI/CD pipeline (needs a GitHub CodeConnections ARN + repo coordinates).
const connectionArn: string | undefined = app.node.tryGetContext("githubConnectionArn");
const ghOwner: string | undefined = app.node.tryGetContext("githubOwner");
const ghRepo: string | undefined = app.node.tryGetContext("githubRepo");
const ghBranch: string = app.node.tryGetContext("githubBranch") ?? "main";
if (domainName && connectionArn && ghOwner && ghRepo) {
  new PipelineStack(app, "MoneyBallPipeline", {
    env,
    domainName,
    connectionArn,
    owner: ghOwner,
    repo: ghRepo,
    branch: ghBranch,
  });
}

app.synth();
