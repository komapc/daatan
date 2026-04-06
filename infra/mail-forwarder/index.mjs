import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";

const s3 = new S3Client({});
const ses = new SESClient({});

// Configuration from Environment Variables
const FORWARD_MAPPING = JSON.parse(process.env.FORWARD_MAPPING || "{}");
const VERIFIED_FROM = process.env.VERIFIED_FROM || "forwarder@daatan.com";
const CATCH_ALL_DESTINATIONS = (process.env.CATCH_ALL_DESTINATIONS || "").split(",").filter(Boolean);

export const handler = async (event) => {
  const sesRecord = event.Records[0].ses;
  const messageId = sesRecord.mail.messageId;
  const originalRecipient = sesRecord.mail.destination[0].toLowerCase();
  const bucketName = process.env.S3_BUCKET;

  console.log(`Processing message ${messageId} for ${originalRecipient}`);

  // 1. Fetch raw email from S3
  const s3Response = await s3.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: messageId
  }));

  const rawEmailBuffer = Buffer.from(await s3Response.Body.transformToByteArray());
  let rawEmail = rawEmailBuffer.toString('utf-8');

  // 2. Determine destinations
  let destinations = [];
  if (FORWARD_MAPPING[originalRecipient]) {
    destinations = Array.isArray(FORWARD_MAPPING[originalRecipient]) 
      ? FORWARD_MAPPING[originalRecipient] 
      : [FORWARD_MAPPING[originalRecipient]];
  } else {
    // Catch-all
    destinations = CATCH_ALL_DESTINATIONS;
  }

  if (destinations.length === 0) {
    console.log("No destination found, dropping email.");
    return;
  }

  // 3. Prepare Forwarding Headers
  // We need to replace From: and add Reply-To:
  // Note: We use regex to handle multi-line headers and case-sensitivity
  
  // Extract original From
  const fromMatch = rawEmail.match(/^From: (.*(?:\r?\n\s+.*)*)/mi);
  const originalFrom = fromMatch ? fromMatch[1].trim() : "unknown@example.com";

  // Rewrite From: to our verified identity
  // We preserve the "Display Name" if possible
  let displayPart = "";
  if (originalFrom.includes("<")) {
    displayPart = originalFrom.split("<")[0].trim();
  } else if (!originalFrom.includes("@")) {
    displayPart = originalFrom;
  }
  
  const newFrom = displayPart 
    ? `${displayPart} via Daatan <${VERIFIED_FROM}>`
    : `Daatan Forwarder <${VERIFIED_FROM}>`;

  // Remove existing Reply-To and From, then inject new ones
  rawEmail = rawEmail.replace(/^From: .*/mi, `From: ${newFrom}`);
  
  if (rawEmail.match(/^Reply-To: /mi)) {
    rawEmail = rawEmail.replace(/^Reply-To: .*/mi, `Reply-To: ${originalFrom}`);
  } else {
    // Inject Reply-To right after From
    rawEmail = rawEmail.replace(/^From: (.*)/mi, `From: $1\r\nReply-To: ${originalFrom}`);
  }
  
  // Remove Return-Path (SES will add its own)
  rawEmail = rawEmail.replace(/^Return-Path: .*/mi, "");

  // 4. Send Raw Email
  try {
    const result = await ses.send(new SendRawEmailCommand({
      RawMessage: {
        Data: Buffer.from(rawEmail, 'utf-8')
      },
      Source: VERIFIED_FROM,
      Destinations: destinations
    }));
    console.log(`Email forwarded to ${destinations.join(", ")}. SES MessageId: ${result.MessageId}`);
  } catch (err) {
    console.error("Failed to forward email:", err);
    throw err;
  }
};
