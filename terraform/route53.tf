# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "DAATAN primary domain"

  tags = {
    Name = "daatan-zone"
  }
}

# ====================================================================
# PRODUCTION DOMAIN RECORDS (daatan.com)
# ====================================================================
# Root domain A record pointing to production instance
resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.production.public_ip]
}

# API subdomain pointing to production instance
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.production.public_ip]
}

# WWW CNAME pointing to root
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain_name]
}

# Mission/OpenClaw chat interface subdomain (production)
resource "aws_route53_record" "mission" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "mission.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.production.public_ip]
}

# ====================================================================
# STAGING DOMAIN RECORDS (staging.daatan.com)
# ====================================================================
# Staging subdomain A record pointing to staging instance
resource "aws_route53_record" "staging" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "staging.${var.domain_name}"
  type    = "A"
  ttl     = 60
  records = [aws_eip.staging.public_ip]
}

# Next testbed subdomain A record pointing to staging instance
resource "aws_route53_record" "next" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "next.${var.domain_name}"
  type    = "A"
  ttl     = 60
  records = [aws_eip.staging.public_ip]
}

# SES Verification TXT record
resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = [aws_ses_domain_identity.main.verification_token]
}

# SES MX Records (Inbound Mail)
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 300
  records = [
    "10 inbound-smtp.${var.aws_region}.amazonaws.com"
  ]
}

# SES DKIM Records
resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${element(aws_ses_domain_dkim.main.dkim_tokens, count.index)}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.main.dkim_tokens, count.index)}.dkim.amazonses.com"]
}

# SES SPF Record (Updated to use include:amazonses.com)
resource "aws_route53_record" "spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = [
    "v=spf1 include:amazonses.com ~all"
  ]
}

# DMARC Record
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = [
    "v=DMARC1; p=none; rua=mailto:mark@${var.domain_name}"
  ]
}

# SES MAIL FROM MX and SPF records
resource "aws_route53_record" "mail_from_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = aws_ses_domain_mail_from.main.mail_from_domain
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = aws_ses_domain_mail_from.main.mail_from_domain
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]
}

# Google Site Verification record (Moved to separate resource for clarity)
resource "aws_route53_record" "google_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = [
    "google-site-verification=ATwti6XWdVyDu_RJlJhqcBsq-Z_lkjA7nq8ooac",
    "google-site-verification=d1d667f41fecd0d0"
  ]
}
