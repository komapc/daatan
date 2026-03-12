# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "DAATAN primary domain"

  tags = {
    Name = "daatan-zone"
  }
}

# A Record pointing to EC2 Elastic IP
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.backend.public_ip]
}

# Root domain A record
resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.backend.public_ip]
}

# WWW CNAME pointing to root
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain_name]
}

# Staging subdomain A record
resource "aws_route53_record" "staging" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "staging.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.backend.public_ip]
}

# Google Site Verification and SPF TXT record
resource "aws_route53_record" "google_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = [
    "google-site-verification=ATwti6XWdVyDu_RJlJhqcBsq-Z_lkjA7nq8ooac",
    "google-site-verification=d1d667f41fecd0d0",
    "v=spf1 include:spf.privateemail.com ~all"
  ]
}
