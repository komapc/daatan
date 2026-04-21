# Mail Forwarder Lambda

AWS Lambda that receives inbound email via SES → S3 and forwards it to a real inbox.

## Architecture

```
Inbound email → SES receipt rule → S3 (daatan-mail-inbound-prod-272007598366)
                                → Lambda (daatan-mail-forwarder-prod)
                                        → rewrites headers
                                        → SES SendRawEmail → komapc@gmail.com
```

Raw mail is retained in S3 for **14 days** — if forwarding fails, the email can be replayed.

## Configuration (Lambda env vars)

| Variable | Example | Description |
|---|---|---|
| `FORWARD_MAPPING` | `{"mark@daatan.com":"komapc@gmail.com"}` | JSON map of `daatan address → destination` |
| `VERIFIED_FROM` | `forwarder@daatan.com` | SES-verified sender identity |
| `CATCH_ALL_DESTINATIONS` | `komapc@gmail.com` | Fallback for addresses not in FORWARD_MAPPING |
| `S3_BUCKET` | `daatan-mail-inbound-prod-272007598366` | S3 bucket where SES stores raw email |

## Header rewriting

SES rejects `SendRawEmail` if the message contains unverified addresses in certain headers or duplicate headers. The Lambda:

1. Rewrites `From:` → `"Original Name via Daatan <forwarder@daatan.com>"`
2. Sets/rewrites `Reply-To:` → original sender address
3. Rewrites `To:` → actual destination
4. Strips `Return-Path`, `Sender`, `Resent-*` (carry unverified addresses)
5. Strips all `DKIM-Signature` and `ARC-*` headers (invalidated by rewrites; SES rejects duplicates)

## Deploy

The Lambda code lives entirely in `index.mjs`. To deploy a change:

```bash
cd infra/mail-forwarder
zip -j lambda.zip index.mjs
aws lambda update-function-code \
  --function-name daatan-mail-forwarder-prod \
  --zip-file fileb://lambda.zip \
  --region eu-central-1
rm lambda.zip
```

> `lambda.zip` is a build artifact — do not commit it. It is gitignored.

## Tests

Tests are co-located in `index.test.mjs` and run as part of the main test suite (`npm test`). They test the header-rewrite logic directly without AWS dependencies.

Known production failure modes covered by tests:
1. Folded `From:` header leaking an unverified address
2. `Return-Path:` removal leaving a leading blank line (Gmail body corruption)
3. `Sender:`/`Resent-*` headers carrying unverified addresses
4. Duplicate `DKIM-Signature` headers (SES `InvalidParameterValue`)

## Monitoring

- CloudWatch alarm: `daatan-mail-forwarder-errors-prod` (eu-central-1)
- Fires when Lambda error count > 0 in a 5-minute window
- SNS → email alert to `komapc@gmail.com`
