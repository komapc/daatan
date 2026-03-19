output "openclaw_public_ip" {
  description = "Static public IP of the OpenClaw EC2 instance"
  value       = aws_eip.openclaw.public_ip
}

output "ssh_command" {
  description = "SSH connection command"
  value       = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.openclaw.public_ip}"
}

output "ssm_command" {
  description = "Connect via SSM (no SSH key needed, uses IAM role)"
  value       = "aws ssm start-session --target ${aws_instance.openclaw.id} --region ${var.aws_region}"
}

output "openclaw_url" {
  description = "OpenClaw web UI (after nginx is configured)"
  value       = "https://${aws_eip.openclaw.public_ip}"
}

output "litellm_url" {
  description = "LiteLLM proxy (internal, accessible from OpenClaw container)"
  value       = "http://host.docker.internal:4000"
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.openclaw.id
}
