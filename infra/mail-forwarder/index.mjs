import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";

const s3 = new S3Client({});
const ses = new SESClient({});

// Configuration from Environment Variables
const FORWARD_MAPPING = JSON.parse(process.env.FORWARD_MAPPING || "{}");
const VERIFIED_FROM = process.env.VERIFIED_FROM || "forwarder@daatan.com";
const CATCH_ALL_DESTINATIONS = (process.env.CATCH_ALL_DESTINATIONS || "").split(",").filter(Boolean);

// RFC 5322 header utilities. Headers can be "folded" across multiple lines:
// any continuation line begins with whitespace (space or tab). A naive
// single-line regex (e.g. /^From: .*/m) only rewrites the first line and
// leaves continuation lines as orphans that the MTA still reads as part of
// the header value — which is how unverified addresses end up in our
// rewritten From: and trigger SES MessageRejected.
const headerBodyRe = (name) =>
  new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*`, "mi");

const headerWithTerminatorRe = (name) =>
  new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*\\r?\\n`, "mi");

const replaceHeader = (raw, name, newValue) =>
  raw.replace(headerBodyRe(name), `${name}: ${newValue}`);

const removeHeader = (raw, name) => raw.replace(headerWithTerminatorRe(name), "");

// Remove ALL occurrences of a header (handles emails with multiple instances, e.g. DKIM-Signature).
const removeAllHeaders = (raw, name) => {
  const re = new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*\\r?\\n`, "gmi");
  return raw.replace(re, "");
};

const hasHeader = (raw, name) =>
  new RegExp(`^${name}:`, "mi").test(raw);

const extractHeader = (raw, name) => {
  const m = raw.match(headerBodyRe(name));
  if (!m) return null;
  // Strip the "Name:" prefix, collapse folded whitespace into a single space.
  return m[0].replace(new RegExp(`^${name}:`, "i"), "").replace(/\s+/g, " ").trim();
};

export const handler = async (event) => {
  const sesRecord = event.Records[0].ses;
  const messageId = sesRecord.mail.messageId;
  const originalRecipient = sesRecord.mail.destination[0].toLowerCase();
  const bucketName = process.env.S3_BUCKET;

  console.log(`Processing message ${messageId} for ${originalRecipient}`);

  // Drop bounce/DSN messages addressed to the forwarder itself to break bounce loops.
  if (originalRecipient === VERIFIED_FROM.toLowerCase()) {
    console.log(`Dropping bounce/DSN message addressed to forwarder (${VERIFIED_FROM}).`);
    return;
  }

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
  const originalFrom = extractHeader(rawEmail, "From") || "unknown@example.com";

  // Preserve the Display Name part when rewriting From:.
  let displayPart = "";
  if (originalFrom.includes("<")) {
    displayPart = originalFrom.split("<")[0].trim();
  } else if (!originalFrom.includes("@")) {
    displayPart = originalFrom;
  }

  const newFrom = displayPart
    ? `${displayPart} via Daatan <${VERIFIED_FROM}>`
    : `Daatan Forwarder <${VERIFIED_FROM}>`;

  // Rewrite From: (folded-aware — see header regex comment above).
  rawEmail = replaceHeader(rawEmail, "From", newFrom);

  // Reply-To: either replace in place or inject right after From:.
  if (hasHeader(rawEmail, "Reply-To")) {
    rawEmail = replaceHeader(rawEmail, "Reply-To", originalFrom);
  } else {
    rawEmail = rawEmail.replace(
      headerBodyRe("From"),
      (m) => `${m}\r\nReply-To: ${originalFrom}`
    );
  }

  // Rewrite To: so Gmail shows the actual destination, not e.g. mark@daatan.com.
  rawEmail = replaceHeader(rawEmail, "To", destinations.join(", "));

  // SES rejects SendRawEmail if any address in From/Sender/Return-Path/Resent-*
  // headers references an unverified identity. Strip everything that can carry
  // a third-party address; SES will regenerate what it needs.
  //
  // Return-Path removal must include the trailing line terminator, otherwise
  // a leading blank line fools RFC 2822 parsers into treating the rest of the
  // headers as body text in Gmail.
  for (const name of ["Return-Path", "Sender", "Resent-From", "Resent-Sender", "Resent-Return-Path"]) {
    rawEmail = removeHeader(rawEmail, name);
  }

  // DKIM-Signature and ARC-* headers are invalidated when we rewrite From/To.
  // SES also rejects emails with duplicate DKIM-Signature headers.
  // Strip them all; SES will add its own DKIM signature on send.
  for (const name of ["DKIM-Signature", "ARC-Seal", "ARC-Message-Signature", "ARC-Authentication-Results"]) {
    rawEmail = removeAllHeaders(rawEmail, name);
  }

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
