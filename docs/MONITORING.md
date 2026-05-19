# Monitoring & Alerts

## Overview

Daatan uses AWS CloudWatch alarms and SNS email notifications for billing and infrastructure monitoring. All alert resources are managed in `terraform/monitoring.tf`.

---

## SNS Topics

| Topic | Region | ARN | Purpose |
|-------|--------|-----|---------|
| `daatan-billing-alerts` | us-east-1 | `arn:aws:sns:us-east-1:272007598366:daatan-billing-alerts` | Billing threshold alerts |
| `daatan-infra-alerts` | eu-central-1 | `arn:aws:sns:eu-central-1:272007598366:daatan-infra-alerts` | EC2 and infrastructure alerts |

Both topics send email to `komapc@gmail.com`. New subscriptions require email confirmation.

> **Note:** Billing alarms must be in `us-east-1` — AWS only publishes `EstimatedCharges` metrics there. The `aws.us_east_1` provider alias in `terraform/main.tf` handles this.

---

## Active Alarms

### Billing (us-east-1)

| Alarm | Threshold | State | Action |
|-------|-----------|-------|--------|
| `billing-alert-50usd` | ≥ $50/day | OK | Email via `daatan-billing-alerts` |
| `billing-alert-150usd` | ≥ $150/day | OK | Email via `daatan-billing-alerts` |
| `billing-alert-200usd` | ≥ $200/day | OK | Email via `daatan-billing-alerts` |

These fire when the rolling daily `EstimatedCharges` (Maximum) crosses the threshold. During the credit period the charges shown may be $0 — the alarms will trigger once credits expire and real charges appear.

### Infrastructure (eu-central-1)

| Alarm | Instance | Metric | Condition | Action |
|-------|----------|--------|-----------|--------|
| `prod-ec2-status-check-failed` | `i-04ea44d4243d35624` (prod) | `StatusCheckFailed` | ≥ 1 for 2 consecutive minutes | Email via `daatan-infra-alerts` (alarm + OK) |
| `daatan-prod-memory-high` | prod | `mem_used_percent` | — | `daatan-infra-alerts` (pre-existing) |
| `daatan-staging-memory-high` | staging | `mem_used_percent` | — | `daatan-infra-alerts` (pre-existing) |

The `StatusCheckFailed` alarm covers both instance status (OS/software) and system status (AWS host hardware). `treat_missing_data = breaching` means a stopped or terminated instance also triggers the alarm.

---

## Terraform

All monitoring resources are in `terraform/monitoring.tf`. The `us-east-1` provider alias is declared in `terraform/main.tf`:

```hcl
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

Resources that need the billing region use `provider = aws.us_east_1`.

### Importing existing resources into state

If alarms were created manually before Terraform managed them, import them:

```bash
# Billing SNS topic
terraform import 'aws_sns_topic.billing_alerts' arn:aws:sns:us-east-1:272007598366:daatan-billing-alerts

# Billing alarms
terraform import 'aws_cloudwatch_metric_alarm.billing_50usd' billing-alert-50usd
terraform import 'aws_cloudwatch_metric_alarm.billing_150usd' billing-alert-150usd
terraform import 'aws_cloudwatch_metric_alarm.billing_200usd' billing-alert-200usd

# Infra SNS topic
terraform import 'aws_sns_topic.infra_alerts' arn:aws:sns:eu-central-1:272007598366:daatan-infra-alerts

# EC2 alarm
terraform import 'aws_cloudwatch_metric_alarm.prod_ec2_status_check' prod-ec2-status-check-failed
```

---

## Adding a new alarm

1. Add the `aws_cloudwatch_metric_alarm` resource to `terraform/monitoring.tf`
2. Point `alarm_actions` at the appropriate SNS topic (`aws_sns_topic.infra_alerts.arn` or `aws_sns_topic.billing_alerts.arn`)
3. `terraform plan` to verify, then `terraform apply`
4. Update this doc

---

## Runbook

**`prod-ec2-status-check-failed` fires:**
1. Check AWS EC2 console → instance state and status checks
2. If instance is running but checks fail: attempt SSM `send-command` to confirm connectivity
3. If SSM unreachable: use EC2 console → Instance Connect or reboot via console
4. Check `/var/log/user-data.log` and `docker ps` output

**Billing alarm fires:**
1. Check AWS Billing Console → Cost Explorer for the spike
2. Check whether credits have expired (Billing → Credits)
3. Review EC2, data transfer, and NAT gateway costs
