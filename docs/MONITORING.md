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

| Alarm | Threshold | Action |
|-------|-----------|--------|
| `billing-alert-50usd` | ≥ $50/day | Email via `daatan-billing-alerts` |
| `billing-alert-150usd` | ≥ $150/day | Email via `daatan-billing-alerts` |
| `billing-alert-200usd` | ≥ $200/day | Email via `daatan-billing-alerts` |

These fire when the rolling daily `EstimatedCharges` (Maximum) crosses the threshold. `EstimatedCharges` is **net of credits** — during the credit period it reads ~$0, so the alarms effectively trigger once credits expire and real charges appear.

### Infrastructure (eu-central-1)

Monitored instances: **prod** `i-04ea44d4243d35624`, **staging** `i-0406d237ca5d92cdf`, **oracle** `i-00ac444b94c5ff9b2` (the retro/TruthMachine box — not managed by daatan terraform, but monitored from it for centralization).

| Alarm | Instance(s) | Metric | Condition | Action |
|-------|-------------|--------|-----------|--------|
| `prod-ec2-status-check-failed` | prod | `StatusCheckFailed` | ≥ 1 for 2 min | Email (alarm + OK) |
| `staging-ec2-status-check-failed` | staging | `StatusCheckFailed` | ≥ 1 for 2 min | Email (alarm + OK) |
| `oracle-ec2-status-check-failed` | oracle | `StatusCheckFailed` | ≥ 1 for 2 min | Email (alarm + OK) |
| `{prod,staging,oracle}-ec2-autorecover` | all | `StatusCheckFailed_System` | ≥ 1 for 2 min | **EC2 auto-recover** + email |
| `{prod,staging,oracle}-ec2-cpu-high` | all | `CPUUtilization` | ≥ 85% for 15 min | Email (alarm + OK) |
| `daatan-prod-memory-high` | prod | `mem_used_percent` (CWAgent) | > 85% for 5 min | Email |
| `daatan-staging-memory-high` | staging | `mem_used_percent` (CWAgent) | > 85% for 5 min | Email |
| `{prod,staging}-ec2-disk-high` | prod, staging | `disk_used_percent` (CWAgent) | ≥ 85% | Email (alarm + OK) |
| `{prod,staging}-ec2-swap-high` | prod, staging | `swap_used_percent` (CWAgent) | ≥ 25% for 15 min | Email (alarm + OK) |

All actions go to `daatan-infra-alerts`. Notes:

- `StatusCheckFailed` covers both instance status (OS/software) and system status (AWS host hardware); `treat_missing_data = breaching` means a stopped/terminated instance also triggers.
- **Auto-recover** fires on the *system* check only (`StatusCheckFailed_System`) and reboots the instance on fresh AWS hardware via the `ec2:recover` action (free; supported on t3/t4g). It also emails so you know it happened.
- **CWAgent metrics** (`mem_/disk_/swap_used_percent`) only exist on prod + staging — the Oracle box has **no CloudWatch agent**, so it gets only the default-EC2-metric alarms (CPU, status check). Install the agent there before adding disk/mem/swap alarms for it.
- Disk-alarm dimensions must match exactly what the agent publishes (`path=/`, `device=nvme0n1p1`, `fstype=ext4`, `InstanceId`) or the alarm sits in `INSUFFICIENT_DATA` forever.

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

`terraform/monitoring.tf` was originally written but never applied, so the resources that *do* exist live (the two SNS topics, `billing-alert-150usd`, `prod-ec2-status-check-failed`, and the two `*-memory-high` alarms) were created manually and are **not in terraform state**. Import them before the first `apply`, otherwise apply collides with "already exists":

```bash
# SNS topics
terraform import 'aws_sns_topic.billing_alerts' arn:aws:sns:us-east-1:272007598366:daatan-billing-alerts
terraform import 'aws_sns_topic.infra_alerts'   arn:aws:sns:eu-central-1:272007598366:daatan-infra-alerts

# Pre-existing alarms (only these three exist live — do NOT import 50usd/200usd, they don't exist yet and are created by apply)
terraform import 'aws_cloudwatch_metric_alarm.billing_150usd'       billing-alert-150usd
terraform import 'aws_cloudwatch_metric_alarm.prod_ec2_status_check' prod-ec2-status-check-failed
terraform import 'aws_cloudwatch_metric_alarm.prod_memory_high'      daatan-prod-memory-high
terraform import 'aws_cloudwatch_metric_alarm.staging_memory_high'   daatan-staging-memory-high
```

After import, `terraform plan` should show: **creates** for the new alarms + `billing-alert-50usd`/`200usd` + the two email subscriptions, and **in-place updates** for the imported memory alarms (they gain the `daatan-infra-alerts` action they currently lack). It must show **no destroy/replace** of imported resources — a replace means a config mismatch to reconcile first.

> Heads-up: a stale `.terraform.tfstate.lock.info` may linger in the dir. If a command errors `Error acquiring the state lock`, recover with `terraform force-unlock <LOCK_ID>`.

---

## Adding a new alarm

1. Add the `aws_cloudwatch_metric_alarm` resource to `terraform/monitoring.tf`
2. Point `alarm_actions` at the appropriate SNS topic (`aws_sns_topic.infra_alerts.arn` or `aws_sns_topic.billing_alerts.arn`)
3. `terraform plan` to verify, then `terraform apply`
4. Update this doc

---

## Runbook

**`*-ec2-status-check-failed` fires:**
1. Check AWS EC2 console → instance state and status checks
2. If instance is running but checks fail: attempt SSM `send-command` to confirm connectivity
3. If SSM unreachable: use EC2 console → Instance Connect or reboot via console
4. Check `/var/log/user-data.log` and `docker ps` output
5. For the **oracle** box, SSM into `i-00ac444b94c5ff9b2`; the app is a systemd service (`oracle-api`) logging to `/home/ubuntu/truthmachine/oracle_log.txt`.

**`*-ec2-autorecover` fires:** AWS detected a host-hardware fault and is auto-recovering the instance onto new hardware. No manual action needed for the recovery itself — but confirm the instance came back, containers/services restarted, and the app is serving. Investigate if it recurs.

**`*-ec2-cpu-high` / `*-ec2-memory-high` / `*-ec2-swap-high` fires:** resource pressure. SSM in and run `docker stats` / `top` / `free -m`. Swap usage on the 2 GB boxes is an early OOM signal — check for a runaway container or a deploy that didn't release the old one. Consider bumping the instance size (credits cover it).

**`*-ec2-disk-high` fires:** root volume ≥ 85%. SSM in and run `df -h`, then `docker system df`; the usual culprit is image/log buildup — `docker system prune -af` and check `/var/lib/docker` and log sizes.

**Billing alarm fires:**
1. Check AWS Billing Console → Cost Explorer for the spike
2. Check whether credits have expired (Billing → Credits)
3. Review EC2, data transfer, and NAT gateway costs
