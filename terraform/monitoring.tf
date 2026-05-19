# ====================================================================
# BILLING ALERTS (us-east-1 — required by AWS)
# ====================================================================

resource "aws_sns_topic" "billing_alerts" {
  provider = aws.us_east_1
  name     = "daatan-billing-alerts"
}

resource "aws_sns_topic_subscription" "billing_alerts_email" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.billing_alerts.arn
  protocol  = "email"
  endpoint  = "komapc@gmail.com"
}

resource "aws_cloudwatch_metric_alarm" "billing_50usd" {
  provider            = aws.us_east_1
  alarm_name          = "billing-alert-50usd"
  alarm_description   = "AWS spend exceeded $50 — credits may be expiring"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  statistic           = "Maximum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 50
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_sns_topic.billing_alerts.arn]

  dimensions = {
    Currency = "USD"
  }
}

resource "aws_cloudwatch_metric_alarm" "billing_150usd" {
  provider            = aws.us_east_1
  alarm_name          = "billing-alert-150usd"
  alarm_description   = "AWS spend exceeded $150 — action required"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  statistic           = "Maximum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 150
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_sns_topic.billing_alerts.arn]

  dimensions = {
    Currency = "USD"
  }
}

resource "aws_cloudwatch_metric_alarm" "billing_200usd" {
  provider            = aws.us_east_1
  alarm_name          = "billing-alert-200usd"
  alarm_description   = "AWS spend exceeded $200 — credits exhausted or nearly gone"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  statistic           = "Maximum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 200
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_sns_topic.billing_alerts.arn]

  dimensions = {
    Currency = "USD"
  }
}

# ====================================================================
# INFRASTRUCTURE ALERTS (eu-central-1)
# ====================================================================

resource "aws_sns_topic" "infra_alerts" {
  name = "daatan-infra-alerts"
}

resource "aws_sns_topic_subscription" "infra_alerts_email" {
  topic_arn = aws_sns_topic.infra_alerts.arn
  protocol  = "email"
  endpoint  = "komapc@gmail.com"
}

# Production EC2 — fires if instance fails host or reachability checks for 2 consecutive minutes
resource "aws_cloudwatch_metric_alarm" "prod_ec2_status_check" {
  alarm_name          = "prod-ec2-status-check-failed"
  alarm_description   = "Production EC2 instance status check failed — instance may be unreachable"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.infra_alerts.arn]
  ok_actions          = [aws_sns_topic.infra_alerts.arn]

  dimensions = {
    InstanceId = aws_instance.production.id
  }
}
