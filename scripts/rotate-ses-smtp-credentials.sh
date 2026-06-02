#!/bin/bash
#
# DAATAN — Rotate AWS SES SMTP credentials for a "Send mail as" sender
#
# Generates a fresh SES SMTP username/password for a dedicated IAM user
# (e.g. ses-smtp-andrey-prod) so a team member can send as their @daatan.com
# address from Gmail's "Send mail as" feature. See docs/EMAIL.md.
#
# The SES SMTP password is NOT the IAM secret access key — it is derived from
# it with an SES-specific algorithm. AWS only shows the secret once, so a
# broken/forgotten password can only be fixed by minting a new key. This script
# does that and writes the result to a chmod-600 file. The secret is never
# printed to the terminal.
#
# Usage:
#   scripts/rotate-ses-smtp-credentials.sh [iam-user]
#
#   iam-user   IAM user to rotate (default: ses-smtp-andrey-prod)
#
# Env overrides:
#   SES_REGION   SES region (default: eu-central-1)
#   OUT_FILE     output path (default: ./<iam-user>-smtp.txt)
#
# Requires: awscli configured with IAM + SES permissions, python3.
#
set -euo pipefail

IAM_USER="${1:-ses-smtp-andrey-prod}"
SES_REGION="${SES_REGION:-eu-central-1}"
OUT_FILE="${OUT_FILE:-./${IAM_USER}-smtp.txt}"
SMTP_HOST="email-smtp.${SES_REGION}.amazonaws.com"

echo "Rotating SES SMTP credentials"
echo "  IAM user : ${IAM_USER}"
echo "  Region   : ${SES_REGION}"
echo "  Out file : ${OUT_FILE}"
echo

# ── Preflight ────────────────────────────────────────────────────────────────
command -v aws     >/dev/null || { echo "ERROR: aws CLI not found"; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found"; exit 1; }

aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1 || {
  echo "ERROR: IAM user '${IAM_USER}' not found (or no permission to read it)."; exit 1; }

# IAM allows at most 2 access keys per user. If there are already 2, stop and let
# the operator decide which to delete — silently deleting a key could break a
# credential that is in use elsewhere.
KEY_COUNT=$(aws iam list-access-keys --user-name "$IAM_USER" \
  --query 'length(AccessKeyMetadata)' --output text)
if [ "$KEY_COUNT" -ge 2 ]; then
  echo "ERROR: ${IAM_USER} already has 2 access keys (the IAM maximum)."
  echo "Delete an unused one first, then re-run:"
  aws iam list-access-keys --user-name "$IAM_USER" \
    --query 'AccessKeyMetadata[].{Key:AccessKeyId,Status:Status,Created:CreateDate}' \
    --output table
  echo
  echo "  aws iam delete-access-key --user-name ${IAM_USER} --access-key-id <OLD_KEY_ID>"
  exit 1
fi

OLD_KEYS=$(aws iam list-access-keys --user-name "$IAM_USER" \
  --query 'AccessKeyMetadata[].AccessKeyId' --output text)

# ── Mint key + derive SMTP password (secret never hits stdout) ────────────────
umask 077
TMP=$(mktemp)
trap 'shred -u "$TMP" 2>/dev/null || rm -f "$TMP"' EXIT

aws iam create-access-key --user-name "$IAM_USER" --output json > "$TMP"

python3 - "$TMP" "$OUT_FILE" "$SES_REGION" "$SMTP_HOST" "$IAM_USER" <<'PY'
import sys, json, hmac, hashlib, base64, datetime
tmp, out_file, region, host, user = sys.argv[1:6]
ak = json.load(open(tmp))["AccessKey"]
akid, secret = ak["AccessKeyId"], ak["SecretAccessKey"]

# AWS SES: derive SMTP password from the IAM secret (SigV4 variant).
def sign(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()
sig = sign(("AWS4" + secret).encode(), "11111111")
for part in (region, "ses", "aws4_request", "SendRawEmail"):
    sig = sign(sig, part)
smtp_password = base64.b64encode(bytes([0x04]) + sig).decode()

with open(out_file, "w") as f:
    f.write(f"""AWS SES SMTP credentials  (Gmail "Send mail as")
Generated: {datetime.date.today().isoformat()}
IAM user:  {user}

  SMTP server:   {host}
  Port:          587  (STARTTLS / "TLS")   — or 465 for SSL
  Username:      {akid}
  Password:      {smtp_password}

Deliver these over a secure channel (not email/chat). After the sender confirms
mail goes out, delete the OLD access key and remove this file.
""")
print("New SMTP username (access key id):", akid)
print("Credentials written to:", out_file, "(mode 600)")
PY

chmod 600 "$OUT_FILE"

# ── Next steps ───────────────────────────────────────────────────────────────
echo
echo "Done. Next:"
echo "  1. Give the contents of ${OUT_FILE} to the sender over a secure channel."
echo "     Gmail → Settings → Accounts and Import → 'Send mail as' → edit the alias."
echo "  2. After they confirm sending works, delete the OLD key(s) and the file:"
for k in $OLD_KEYS; do
  echo "       aws iam delete-access-key --user-name ${IAM_USER} --access-key-id ${k}"
done
echo "       rm ${OUT_FILE}"
