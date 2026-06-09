import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface BastionStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
  allowedIp: string; // your IP, e.g. "68.58.132.255"
  rdsEndpoint: string;
}

// Idle auto-stop: every 5 min, if there's no SSH login and no established
// connection on :22 (SSH) or :5432 (a DB tunnel), bump a counter; after 12
// strikes (~60 min) stop the instance. Any activity resets it.
const IDLE_SCRIPT = `#!/bin/bash
STATE=/var/run/idle-count
if who | grep -q . || ss -tn state established 2>/dev/null | grep -qE ':22 |:5432 '; then
  echo 0 > "$STATE"; exit 0
fi
c=$(cat "$STATE" 2>/dev/null || echo 0); c=$((c + 1)); echo "$c" > "$STATE"
[ "$c" -ge 12 ] && /sbin/shutdown -h now
`;

/**
 * A tiny, on-demand bastion for querying the private RDS instance from a GUI or
 * psql. Locked to a single IP, auto-stops when idle, and is stopped by default
 * cost-wise (you start it only when you need it).
 */
export class BastionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BastionStackProps) {
    super(scope, id, props);
    const { vpc, dbSecurityGroup, allowedIp, rdsEndpoint } = props;

    const bastionSg = new ec2.SecurityGroup(this, "BastionSg", {
      vpc,
      description: "psql bastion - SSH from one allow-listed IP",
      allowAllOutbound: true,
    });
    bastionSg.addIngressRule(ec2.Peer.ipv4(`${allowedIp}/32`), ec2.Port.tcp(22), "SSH from my IP");

    // Let the bastion (and only the bastion) reach Postgres.
    new ec2.CfnSecurityGroupIngress(this, "BastionToPostgresIngress", {
      groupId: dbSecurityGroup.securityGroupId,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: bastionSg.securityGroupId,
      description: "bastion to postgres",
    });

    const role = new iam.Role(this, "BastionRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        // Enables keyless access via `aws ssm start-session` as well.
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    const keyPair = new ec2.KeyPair(this, "BastionKey", { keyPairName: "moneyball-bastion" });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "dnf install -y postgresql15 || yum install -y postgresql15 || true",
      // Install the idle-stop script + cron.
      `cat > /usr/local/bin/idle-check.sh <<'EOS'\n${IDLE_SCRIPT}EOS`,
      "chmod +x /usr/local/bin/idle-check.sh",
      'echo "*/5 * * * * root /usr/local/bin/idle-check.sh" > /etc/cron.d/idle-check',
      // Convenience: PGHOST preset so you can just `psql -U postgres -d appdb`.
      `echo "export PGHOST=${rdsEndpoint}" >> /home/ec2-user/.bashrc`,
    );

    const instance = new ec2.Instance(this, "Bastion", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: bastionSg,
      role,
      keyPair,
      associatePublicIpAddress: true,
      // `shutdown -h` from the idle script STOPS (not terminates) the instance.
      instanceInitiatedShutdownBehavior: ec2.InstanceInitiatedShutdownBehavior.STOP,
      userData,
    });

    new cdk.CfnOutput(this, "BastionInstanceId", { value: instance.instanceId });
    new cdk.CfnOutput(this, "BastionKeyParam", {
      value: `/ec2/keypair/${keyPair.keyPairId}`,
      description: "SSM parameter holding the private key",
    });
    new cdk.CfnOutput(this, "RdsEndpoint", { value: rdsEndpoint });
  }
}
