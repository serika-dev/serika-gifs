import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: 'eu-central-003',
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
})

export async function uploadToB2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    Body: file,
    ContentType: contentType,
  })

  await s3Client.send(command)
  
  return `https://${process.env.B2_BUCKET_NAME}.${process.env.B2_ENDPOINT}/${key}`
}

export async function deleteFromB2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
  })

  await s3Client.send(command)
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

export function getPublicUrl(key: string): string {
  return `https://${process.env.B2_BUCKET_NAME}.${process.env.B2_ENDPOINT}/${key}`
}

export { s3Client }
