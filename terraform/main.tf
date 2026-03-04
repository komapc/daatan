terraform {
  required_version = ">= 1.0"

  backend "s3" {
    bucket  = "daatan-terraform-state"
    region  = "eu-central-1"
    encrypt = true
    # key and dynamodb_table are provided via backend-*.hcl config files
    # Use: terraform init -backend-config=backend-staging.hcl
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "daatan"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }

  ignore_tags {
    key_prefixes = ["awsApplication"]
  }
}

