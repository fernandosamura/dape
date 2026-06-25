import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import fs from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const r2Client = new S3Client({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!
  }
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

export const uploadToR2 = async (
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<string> => {
  const fileStream = fs.createReadStream(filePath);
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileStream,
      ContentType: mimeType
    })
  );
  return fileName;
};

export const deleteFromR2 = async (fileName: string): Promise<void> => {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName
    })
  );
};

export const downloadFromR2 = async (
  fileName: string,
  destPath: string
): Promise<void> => {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName
    })
  );
  const stream = response.Body as Readable;
  await pipeline(stream, fs.createWriteStream(destPath));
};

export default r2Client;
