output "openclaw_public_ip" {
  description = "Public IP of the OpenClaw EC2 instance"
  value       = aws_eip.openclaw.public_ip
}

output "ssh_instructions" {
  description = "SSH connection command (use key from terraform.tfvars ssh_key_name)"
  value       = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.openclaw.public_ip}"
}

output "github_deploy_key_instruction" {
  description = "How to get the GitHub deploy key"
  value       = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.openclaw.public_ip} 'cat ~/.ssh/id_github.pub'"
}
