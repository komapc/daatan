# S3 Bucket for database backups
resource "aws_s3_bucket" "backups" {
  # Use existing naming convention for Prod to prevent bucket recreation/data loss
  # Use environment suffix for Staging to ensure unique bucket name
  bucket = var.environment == "prod" ? "daatan-db-backups-${data.aws_caller_identity.current.account_id}" : "daatan-db-backups-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "daatan-db-backups"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Block public access
resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for backup history
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle rule to delete old backups
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# IAM role for EC2 to access S3
resource "aws_iam_role" "ec2_role" {
  name = "daatan-ec2-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "daatan-ec2-role-${var.environment}"
  }
}

# IAM policy for S3 backup access
resource "aws_iam_role_policy" "ec2_s3_policy" {
  name = "daatan-s3-backup-policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      }
    ]
  })
}

# Instance profile to attach role to EC2
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "daatan-ec2-profile-${var.environment}"
  role = aws_iam_role.ec2_role.name
}

