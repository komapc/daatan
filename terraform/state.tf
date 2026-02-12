# S3 bucket for Terraform state (must be created before enabling backend)
# Bootstrap: comment out the backend block in main.tf, run terraform apply,
# then uncomment the backend block and run terraform init -migrate-state

resource "aws_s3_bucket" "terraform_state" {
  count = var.environment == "prod" ? 1 : 0
  bucket = "daatan-terraform-state"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "daatan-terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  count = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  count = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  count = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "terraform_locks" {
  count = var.environment == "prod" ? 1 : 0
  name         = "daatan-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = "daatan-terraform-locks"
  }
}
