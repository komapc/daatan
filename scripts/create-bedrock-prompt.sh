#!/usr/bin/env bash
# create-bedrock-prompt.sh — Create a new Bedrock prompt and register it in SSM.
#
# Usage:
#   ./scripts/create-bedrock-prompt.sh <prompt-name> <prompt-text-file> [--env staging|prod|both]
#
# Examples:
#   ./scripts/create-bedrock-prompt.sh content-moderation prompts/content-moderation.txt
#   ./scripts/create-bedrock-prompt.sh content-moderation prompts/content-moderation.txt --env both
#
# The script:
#   1. Creates the Bedrock prompt with a single "default" text variant
#   2. Creates version :1
#   3. Registers the versioned ARN in SSM for the given env(s)
#   4. Outputs the ARN so you can use promote-prompt.sh later for updates

set -euo pipefail

PROMPT_NAME=${1:-}
TEXT_FILE=${2:-}
ENV_ARG=${4:-staging}   # default: staging only; use "both" for prod+staging
REGION="eu-central-1"

if [[ -z "$PROMPT_NAME" || -z "$TEXT_FILE" ]]; then
  echo "Usage: $0 <prompt-name> <prompt-text-file> [--env staging|prod|both]"
  exit 1
fi

if [[ "$3" == "--env" ]]; then
  ENV_ARG=$4
fi

if [[ ! -f "$TEXT_FILE" ]]; then
  echo "Error: text file not found: $TEXT_FILE"
  exit 1
fi

PROMPT_TEXT=$(cat "$TEXT_FILE")

echo "→ Creating Bedrock prompt: $PROMPT_NAME"

# Build the variants JSON safely via jq
VARIANTS_JSON=$(jq -n \
  --arg text "$PROMPT_TEXT" \
  '[{
    "name": "default",
    "templateType": "TEXT",
    "templateConfiguration": {
      "text": { "text": $text }
    }
  }]')

# Create the prompt (draft)
CREATE_OUTPUT=$(aws bedrock-agent create-prompt \
  --name "$PROMPT_NAME" \
  --variants "$VARIANTS_JSON" \
  --region "$REGION" \
  --output json)

PROMPT_ID=$(echo "$CREATE_OUTPUT" | jq -r '.id')
echo "✓ Prompt created: $PROMPT_ID"

# Create version :1
VERSION_OUTPUT=$(aws bedrock-agent create-prompt-version \
  --prompt-identifier "$PROMPT_ID" \
  --region "$REGION" \
  --output json)

VERSION=$(echo "$VERSION_OUTPUT" | jq -r '.version')
ARN="arn:aws:bedrock:${REGION}:272007598366:prompt/${PROMPT_ID}:${VERSION}"
echo "✓ Version created: :$VERSION"
echo "  ARN: $ARN"

# Register in SSM
register_ssm() {
  local env=$1
  local ssm_path="/daatan/${env}/prompts/${PROMPT_NAME}"
  aws ssm put-parameter \
    --name "$ssm_path" \
    --value "$ARN" \
    --type String \
    --overwrite \
    --region "$REGION" \
    --output text > /dev/null
  echo "✓ Registered in SSM: $ssm_path → $ARN"
}

case "$ENV_ARG" in
  staging) register_ssm staging ;;
  prod)    register_ssm prod ;;
  both)    register_ssm staging; register_ssm prod ;;
  *)
    echo "Error: --env must be staging, prod, or both"
    exit 1
    ;;
esac

echo ""
echo "Done. To update this prompt later:"
echo "  1. Edit the text file and run this script again (creates a new version)"
echo "  2. Or: ./scripts/promote-prompt.sh <env> $PROMPT_NAME <new-arn>"
echo ""
echo "To rollback:"
echo "  ./scripts/promote-prompt.sh <env> $PROMPT_NAME --rollback"
