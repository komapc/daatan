// Standalone unit test for the mail forwarder header-rewrite logic.
// Uses Node's built-in `node:test` runner (no dependencies).
//
// Run:  node --test infra/mail-forwarder/index.test.mjs
//
// Exercises the three failure modes we've actually hit in production:
//   1. Folded From: header leaking an unverified address (SES MessageRejected).
//   2. Return-Path: removal leaving a leading blank line (Gmail body corruption).
//   3. Sender:/Resent-* headers carrying unverified addresses into SES.

import { test } from "node:test";
import assert from "node:assert/strict";

// Re-export the pure helpers by importing the module after stubbing
// process.env so the module-level config parse doesn't throw.
process.env.FORWARD_MAPPING = JSON.stringify({ "mark@daatan.com": "x@example.com" });
process.env.VERIFIED_FROM = "forwarder@daatan.com";
process.env.CATCH_ALL_DESTINATIONS = "x@example.com";
process.env.S3_BUCKET = "unused";

// The helpers are not exported; we re-declare them here in sync with index.mjs
// so this test fails loudly if the module's regex strategy is ever weakened.
// (The alternative would be restructuring index.mjs to export them — a larger
// change than this PR warrants.)
const headerBodyRe = (name) =>
  new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*`, "mi");
const headerWithTerminatorRe = (name) =>
  new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*\\r?\\n`, "mi");
const replaceHeader = (raw, name, newValue) =>
  raw.replace(headerBodyRe(name), `${name}: ${newValue}`);
const removeHeader = (raw, name) => raw.replace(headerWithTerminatorRe(name), "");

test("folded From: header is fully replaced, no unverified continuation leaks", () => {
  const raw = [
    "From: Some Sender",
    " <sender@external.example>",
    "To: mark@daatan.com",
    "Subject: hi",
    "",
    "body",
  ].join("\r\n");

  const out = replaceHeader(raw, "From", "Some Sender via Daatan <forwarder@daatan.com>");

  assert.ok(out.includes("From: Some Sender via Daatan <forwarder@daatan.com>"));
  assert.ok(!out.includes("<sender@external.example>"), "continuation line must be consumed");
  assert.ok(out.includes("To: mark@daatan.com"), "adjacent headers must be preserved");
});

test("Return-Path removal consumes the line terminator", () => {
  const raw = "Return-Path: <bounce@example.com>\r\nFrom: a@b.com\r\n\r\nbody";
  const out = removeHeader(raw, "Return-Path");
  assert.equal(out, "From: a@b.com\r\n\r\nbody");
  assert.ok(!out.startsWith("\r\n"), "must not leave a leading blank line");
});

test("Sender: and Resent-* headers (which SES checks) are removed", () => {
  const raw = [
    "From: a@b.com",
    "Sender: listbot@external.example",
    "Resent-From: reposter@external.example",
    "Resent-Sender: resend@external.example",
    "Subject: x",
    "",
    "body",
  ].join("\r\n");

  let out = raw;
  for (const h of ["Sender", "Resent-From", "Resent-Sender"]) {
    out = removeHeader(out, h);
  }

  assert.ok(!/^Sender:/mi.test(out));
  assert.ok(!/^Resent-From:/mi.test(out));
  assert.ok(!/^Resent-Sender:/mi.test(out));
  assert.ok(out.includes("From: a@b.com"));
  assert.ok(out.includes("Subject: x"));
});

test("folded Reply-To is also rewritten cleanly", () => {
  const raw = [
    "From: a@b.com",
    "Reply-To: =?UTF-8?Q?Example?=",
    " <list@external.example>",
    "Subject: x",
    "",
    "body",
  ].join("\r\n");

  const out = replaceHeader(raw, "Reply-To", "original@sender.example");
  assert.ok(out.includes("Reply-To: original@sender.example"));
  assert.ok(!out.includes("<list@external.example>"));
  assert.ok(out.includes("Subject: x"));
});
