import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const inputBucket = process.env.INPUT_S3_BUCKET;
const outputBucket = process.env.OUTPUT_S3_BUCKET;
const s3Key = process.env.S3_KEY;

const fileName = path.basename(s3Key, ".mp4");
const localInputPath = path.join(process.cwd(), `${fileName}.mp4`);

async function downloadVideo() {
  const command = new GetObjectCommand({ Bucket: inputBucket, Key: s3Key });
  const response = await s3.send(command);
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(localInputPath);
    response.Body.pipe(stream).on("finish", resolve).on("error", reject);
  });
}

function runFFmpeg(outputRes) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(process.cwd(), `${fileName}_${outputRes}p.mp4`);
    const scaleMap = { 1080: "1920:1080", 720: "1280:720", 360: "640:360" };
    ffmpeg(localInputPath)
      .videoFilters(`scale=${scaleMap[outputRes]}`)
      .output(outputFile)
      .on("end", () => resolve(outputFile))
      .on("error", reject)
      .run();
  });
}

async function uploadToS3(filePath, res) {
  const data = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: outputBucket,
    Key: `videos/${fileName}/${res}p.mp4`,
    Body: data,
    ContentType: "video/mp4",
  });
  await s3.send(command);
}

(async () => {
  try {
    console.log("Downloading...");
    await downloadVideo();

    for (const res of [1080, 720, 360]) {
      console.log(`Transcoding ${res}p...`);
      const outputFile = await runFFmpeg(res);
      console.log(`Uploading ${res}p...`);
      await uploadToS3(outputFile, res);
    }

    console.log("All done!");
  } catch (err) {
    console.error("Error in transcoding task:", err);
    process.exit(1);
  }
})();
