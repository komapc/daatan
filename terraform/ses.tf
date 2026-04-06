# ====================================================================
# SES DOMAIN IDENTITY (daatan.com)
# ====================================================================

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Custom MAIL FROM domain for better SPF alignment
resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "mail.${var.domain_name}"
}

# ====================================================================
# S3 BUCKET FOR INCOMING MAIL
# ====================================================================

resource "aws_s3_bucket" "mail" {
  bucket = "daatan-mail-inbound-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "daatan-mail-inbound"
    Environment = var.environment
    Purpose     = "ses-mail-storage"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "mail" {
  bucket = aws_s3_bucket.mail.id

  rule {
    id     = "auto-delete-old-mail"
    status = "Enabled"

    expiration {
      days = 1
    }

    filter {}
  }
}

resource "aws_s3_bucket_policy" "ses_write_mail" {
  bucket = aws_s3_bucket.mail.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action = "s3:PutObject"
        Resource = "${aws_s3_bucket.mail.arn}/*"
        Condition = {
          StringEquals = {
            "aws:Referer" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# ====================================================================
# LAMBDA FORWARDER
# ====================================================================

# Zip the lambda code
data "archive_file" "mail_forwarder" {
  type        = "zip"
  source_file = "${path.module}/../infra/mail-forwarder/index.mjs"
  output_path = "${path.module}/../infra/mail-forwarder/lambda.zip"
}

resource "aws_iam_role" "lambda_forwarder" {
  name = "daatan-mail-forwarder-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_forwarder" {
  name = "daatan-mail-forwarder-policy"
  role = aws_iam_role.lambda_forwarder.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.mail.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "forwarder" {
  filename         = data.archive_file.mail_forwarder.output_path
  function_name    = "daatan-mail-forwarder-${var.environment}"
  role             = aws_iam_role.lambda_forwarder.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.mail_forwarder.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      S3_BUCKET              = aws_s3_bucket.mail.id
      VERIFIED_FROM          = "forwarder@${var.domain_name}"
      FORWARD_MAPPING        = jsonencode({
        "mark@daatan.com"   = "komapc@gmail.com",
        "andrey@daatan.com" = "andrey1bar@gmail.com"
      })
      CATCH_ALL_DESTINATIONS = "komapc@gmail.com,andrey1bar@gmail.com"
    }
  }
}

resource "aws_lambda_permission" "allow_ses" {
  statement_id  = "AllowExecutionFromSES"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.forwarder.function_name
  principal     = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

# ====================================================================
# SES RECEIPT RULES
# ====================================================================

resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "daatan-rules-${var.environment}"
}

# Note: Only one rule set can be active at a time in an AWS region.
# You will need to manually activate this rule set in the SES console
# or use a resource to manage it (though it can conflict if one exists).
resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

resource "aws_ses_receipt_rule" "forwarding" {
  name          = "forward-all-daatan"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = [var.domain_name] # Matches any@daatan.com
  enabled       = true
  scan_enabled  = true
  tls_policy    = "Optional"

  s3_action {
    bucket_name = aws_s3_bucket.mail.id
    position    = 1
  }

  lambda_action {
    function_arn = aws_lambda_function.forwarder.arn
    position     = 2
  }
}
