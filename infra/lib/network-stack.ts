import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

// Container ports the two services listen on.
export const FRONTEND_PORT = 3000;
export const BACKEND_PORT = 8000;

/**
 * Lean network: a VPC with public subnets only (no NAT gateway, ~$32/mo saved).
 * Fargate tasks run with public IPs so they can reach the internet (MLB API,
 * W&B, ECR) directly. Isolation is enforced by security groups, not subnet tier:
 *   internet -> ALB (80/443) -> services (3000/8000) -> RDS (5432)
 */
export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly albSecurityGroup: ec2.SecurityGroup;
  readonly serviceSecurityGroup: ec2.SecurityGroup;
  readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // 2 AZs for ALB resilience; public subnets only, no NAT gateways.
    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    // ALB: the only thing exposed to the internet.
    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSg", {
      vpc: this.vpc,
      description: "ALB - public HTTP/HTTPS",
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP");
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");

    // Services: reachable only from the ALB, on their container ports.
    this.serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSg", {
      vpc: this.vpc,
      description: "Fargate services - from ALB only",
      allowAllOutbound: true,
    });
    this.serviceSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(FRONTEND_PORT),
      "ALB to frontend",
    );
    this.serviceSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(BACKEND_PORT),
      "ALB to backend",
    );
    // Allow services to talk to each other (frontend to backend, internal).
    this.serviceSecurityGroup.addIngressRule(
      this.serviceSecurityGroup,
      ec2.Port.tcp(BACKEND_PORT),
      "frontend to backend internal",
    );

    // Database: reachable only from the services, on the Postgres port.
    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSg", {
      vpc: this.vpc,
      description: "RDS - from services only",
      allowAllOutbound: true,
    });
    this.dbSecurityGroup.addIngressRule(
      this.serviceSecurityGroup,
      ec2.Port.tcp(5432),
      "services to postgres",
    );
  }
}
