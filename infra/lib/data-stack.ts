import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

interface DataStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

/**
 * Managed PostgreSQL on RDS. Lean settings: smallest burstable instance,
 * single-AZ, in public subnets but NOT publicly accessible (reachable only from
 * the services' security group). Credentials are auto-generated into Secrets
 * Manager — never hard-coded — and injected into the tasks by the AppStack.
 */
export class DataStack extends cdk.Stack {
  readonly instance: rds.DatabaseInstance;
  readonly databaseName = "appdb";

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.instance = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc: props.vpc,
      // Public subnets (we have no private ones), but no public IP.
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      publiclyAccessible: false,
      securityGroups: [props.dbSecurityGroup],
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO,
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 50, // storage autoscaling ceiling
      multiAz: false,
      databaseName: this.databaseName,
      // Auto-generate a password into Secrets Manager for user "postgres".
      // Exclude characters that would need escaping inside a postgres:// URL,
      // since the app composes DATABASE_URL from these fields.
      credentials: rds.Credentials.fromGeneratedSecret("postgres", {
        excludeCharacters: "/@\" :%+&?#[]{}<>,;()=\\`'",
      }),
      backupRetention: cdk.Duration.days(1),
      // Faux app: allow teardown without snapshot friction.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });
  }

  /** The generated secret holds host/port/username/password/dbname as JSON. */
  get credentialsSecret() {
    return this.instance.secret!;
  }
}
