resource "aws_ecr_repository" "daatan_app" {
  name                 = "daatan-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "daatan-app"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Lifecycle policy to keep only recent images
resource "aws_ecr_lifecycle_policy" "daatan_app_policy" {
  repository = aws_ecr_repository.daatan_app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Remove untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Output ECR repository URL
output "ecr_repository_url" {
  value       = aws_ecr_repository.daatan_app.repository_url
  description = "ECR repository URL for daatan-app"
}

output "ecr_registry" {
  value       = split("/", aws_ecr_repository.daatan_app.repository_url)[0]
  description = "ECR registry domain"
}
