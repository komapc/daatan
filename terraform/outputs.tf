output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

# ====================================================================
# PRODUCTION INSTANCE OUTPUTS
# ====================================================================
output "production_ec2_public_ip" {
  description = "Production EC2 Elastic IP address (daatan.com)"
  value       = aws_eip.production.public_ip
}

output "production_ec2_instance_id" {
  description = "Production EC2 instance ID"
  value       = aws_instance.production.id
}

output "production_ssh_command" {
  description = "SSH command to connect to production EC2 via SSM (preferred) or direct"
  value       = "aws ssm start-session --target ${aws_instance.production.id} --document-name AWS-StartInteractiveCommand"
}

# ====================================================================
# STAGING INSTANCE OUTPUTS
# ====================================================================
output "staging_ec2_public_ip" {
  description = "Staging EC2 Elastic IP address (staging.daatan.com)"
  value       = aws_eip.staging.public_ip
}

output "staging_ec2_instance_id" {
  description = "Staging EC2 instance ID"
  value       = aws_instance.staging.id
}

output "staging_ssh_command" {
  description = "SSH command to connect to staging EC2 via SSM (preferred) or direct"
  value       = "aws ssm start-session --target ${aws_instance.staging.id} --document-name AWS-StartInteractiveCommand"
}

# ====================================================================
# DATABASE BACKUPS
# ====================================================================
output "s3_backup_bucket_production" {
  description = "S3 bucket for production database backups"
  value       = aws_s3_bucket.backups.bucket
}

output "s3_backup_bucket_staging" {
  description = "S3 bucket for staging database backups"
  value       = aws_s3_bucket.backups_staging.bucket
}

# ====================================================================
# DNS & NETWORKING
# ====================================================================
output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "Name servers to configure in Namecheap"
  value       = aws_route53_zone.main.name_servers
}

output "database_connection_string" {
  description = "PostgreSQL connection string for local Docker"
  value       = "postgresql://daatan:PASSWORD@localhost:5432/daatan"
  sensitive   = true
}
