#!/bin/bash
# Backup PostgreSQL database to S3
set -e

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="/tmp/daatan-backup-${TIMESTAMP}.sql.gz"
S3_BUCKET="${S3_BACKUP_BUCKET:-daatan-db-backups-272007598366}"
DB_CONTAINER="${DB_CONTAINER:-daatan-postgres}"
DB_NAME="${DB_NAME:-daatan}"
DB_USER="${DB_USER:-daatan}"

echo "📦 Starting DB backup at $TIMESTAMP"

# Dump and compress
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
echo "✅ Dump complete: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Upload to S3
aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/${TIMESTAMP}.sql.gz"
echo "✅ Uploaded to s3://${S3_BUCKET}/backups/${TIMESTAMP}.sql.gz"

# Cleanup local file
rm -f "$BACKUP_FILE"

# Keep only last 30 days of backups
aws s3 ls "s3://${S3_BUCKET}/backups/" | awk '{print $4}' | sort | head -n -60 | while read -r key; do
  aws s3 rm "s3://${S3_BUCKET}/backups/$key"
  echo "🗑️ Removed old backup: $key"
done

echo "✅ Backup completed successfully"
