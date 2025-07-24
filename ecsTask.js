import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

const ecs = new ECSClient({ region: "ap-south-1" });

export const runECSTask = async (s3Key) => {
  const command = new RunTaskCommand({
    cluster: process.env.ECS_CLUSTER_ARN,
    launchType: "FARGATE",
    taskDefinition: process.env.TASK_DEFENITION_ARN,
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ["subnet-02d2e6be345fde08e","subnet-0d4cf45cb89645acb","subnet-02910a784a5f519ae"],
        assignPublicIp: "ENABLED",
        securityGroups: ["sg-0dc1589a481e4569d"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "vide-transcoding-con",
          environment: [
            { name: "INPUT_S3_BUCKET", value: process.env.INPUT_S3_BUCKET },
            { name: "OUTPUT_S3_BUCKET", value: process.env.OUTPUT_S3_BUCKET },
            { name: "S3_KEY", value: s3Key },
            { name: "AWS_REGION", value: "ap-south-1" },
            { name: "AWS_ACCESS_KEY_ID", value: process.env.AWS_ACCESS_KEY_ID },
            { name: "AWS_SECRET_ACCESS_KEY", value: process.env.AWS_SECRET_ACCESS_KEY },
          ],
        },
      ],
    },
  });

  const response = await ecs.send(command);
  console.log("ECS Task started:", response.tasks[0].taskArn);
};
