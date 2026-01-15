output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "ec2_public_ip" {
  description = "EC2 Elastic IP address"
  value       = aws_eip.backend.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.backend.id
}

output "s3_backup_bucket" {
  description = "S3 bucket for database backups"
  value       = aws_s3_bucket.backups.bucket
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "Name servers to configure in Namecheap"
  value       = aws_route53_zone.main.name_servers
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.backend.public_ip}"
}

output "database_connection_string" {
  description = "PostgreSQL connection string for local Docker"
  value       = "postgresql://daatan:PASSWORD@localhost:5432/daatan"
  sensitive   = true
}
