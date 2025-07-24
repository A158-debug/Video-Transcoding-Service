import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { runECSTask } from "./ECSTask.js";
import dotenv from "dotenv";
dotenv.config();

const sqs = new SQSClient({ region: "ap-south-1" });

const QUEUE_URL = process.env.SQS_QUEUE_URL;


async function pollQueue() {
  while (true) {
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 10,
    };

    try {
      const result = await sqs.send(new ReceiveMessageCommand(params));
      if (!result.Messages || result.Messages.length === 0) {
        console.log("[INFO] No messages in the queue.");
        continue; // No messages, continue polling
      }

      for (const message of result.Messages) {
        const { MessageId, Body } = message;

        if (!Body) {
          console.log("[INFO] Empty message body, skipping.");
          continue; // Skip empty messages
        }

        const event = JSON.parse(Body);

        // Check if the message is a test event
        if ("Service" in event && "Event" in event) {
          if (event.Service === "S3" && event.Event === "s3:TestEvent") continue;
        }

        // Check for S3 event structure
        if (event?.Records && Array.isArray(event?.Records)) {
          for (const record of event.Records) {
            if (record.s3) {
              const bucket = record.s3.bucket.name;
              const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
              console.log("S3 Bucket:", bucket);
              console.log("S3 Key:", key);

              // process each record
              await runECSTask(key);

              // Delete the message after processing
              await sqs.send(
                new DeleteMessageCommand({
                  QueueUrl: QUEUE_URL,
                  ReceiptHandle: message.ReceiptHandle,
                })
              );
              console.log(`[INFO] Message ${MessageId} processed and deleted.`);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error polling SQS queue:", error);
      continue;
    }
  }
}

pollQueue();
