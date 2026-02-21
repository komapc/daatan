# Mission Control - Secure Email Authentication

## 🔐 New Authentication System

Mission Control now uses **email-based authentication with verification codes** instead of simple passwords.

---

## 🎯 How It Works

```
1. User enters email → 2. System sends 6-digit code → 3. User enters code → 4. Access granted
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Email Whitelist** | Only pre-approved emails can request access |
| **Verification Codes** | 6-digit codes, expire in 10 minutes |
| **Session Management** | 24-hour sessions stored in Redis |
| **No Passwords** | No passwords to steal or forget |
| **Audit Trail** | All login attempts logged |

---

## 📧 Current Whitelist

| Email | Status |
|-------|--------|
| `komapc@gmail.com` | ✅ Approved |

---

## 🔧 Adding New Users

### 1. Update Whitelist

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184

# Edit auth service config
sudo nano /opt/mission-auth/.env

# Add email to ALLOWED_EMAILS (comma-separated)
ALLOWED_EMAILS=komapc@gmail.com,newuser@example.com,another@example.com

# Restart service
sudo systemctl restart mission-auth
```

### 2. User Login Flow

The new user will:

1. Visit https://mission.daatan.com
2. Enter their email address
3. Check email for 6-digit verification code
4. Enter the code on the website
5. Get access for 24 hours

---

## 📤 Email Configuration (Optional)

By default, verification codes are logged to the service console. To send real emails:

### Using SendGrid

1. **Get SendGrid API Key:**
   - Sign up at https://sendgrid.com
   - Create API key with "Mail Send" permissions

2. **Update Configuration:**

```bash
sudo nano /opt/mission-auth/.env
```

```env
SENDGRID_API_KEY=SG.xxxxxx.yyyyyy
FROM_EMAIL=noreply@mission.daatan.com
```

3. **Restart Service:**

```bash
sudo systemctl restart mission-auth
```

---

## 🔍 Monitoring & Logs

### Check Service Status

```bash
sudo systemctl status mission-auth
```

### View Logs

```bash
# Service logs
sudo journalctl -u mission-auth -f

# Verification codes (if not using SendGrid)
sudo journalctl -u mission-auth | grep "VERIFICATION CODE"

# Redis sessions
redis-cli KEYS "session:*"
redis-cli KEYS "code:*"
```

### Health Check

```bash
curl http://127.0.0.1:5001/health
# Returns: {"status":"healthy","redis":true,"allowed_emails":1}
```

---

## 🚨 Troubleshooting

### User Can't Login

1. **Check if email is whitelisted:**
   ```bash
   grep ALLOWED_EMAILS /opt/mission-auth/.env
   ```

2. **Check service is running:**
   ```bash
   sudo systemctl status mission-auth
   ```

3. **Check Redis is running:**
   ```bash
   sudo systemctl status redis-server
   ```

4. **Check logs for errors:**
   ```bash
   sudo journalctl -u mission-auth -n 50
   ```

### Code Not Received

- **Without SendGrid:** Codes are logged to console
  ```bash
  sudo journalctl -u mission-auth | grep "VERIFICATION CODE"
  ```

- **With SendGrid:** Check SendGrid dashboard for delivery status

### Session Issues

```bash
# List active sessions
redis-cli KEYS "session:*"

# List pending codes
redis-cli KEYS "code:*"

# Clear all sessions (force re-login)
redis-cli KEYS "session:*" | xargs redis-cli DEL
```

---

## 🔒 Security Best Practices

### 1. Regular Email Review

Periodically review and clean the whitelist:
```bash
cat /opt/mission-auth/.env | grep ALLOWED_EMAILS
```

### 2. Session Timeout

Current session timeout: **24 hours**

To change:
```bash
sudo nano /opt/mission-auth/app.py
# Edit: SESSION_TIMEOUT = timedelta(hours=24)
sudo systemctl restart mission-auth
```

### 3. Code Timeout

Current code timeout: **10 minutes**

To change:
```bash
sudo nano /opt/mission-auth/app.py
# Edit: CODE_TIMEOUT = timedelta(minutes=10)
sudo systemctl restart mission-auth
```

### 4. Firewall Rules

Only necessary ports should be open:
- Port 443 (HTTPS) - Open to all
- Port 80 (HTTP) - Redirects to HTTPS
- Port 5001 (Auth service) - Localhost only
- Port 18789 (OpenClaw) - Localhost only

---

## 📊 Architecture

```
┌─────────────────┐
│    User         │
│    Browser      │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│     Nginx       │
│  (Reverse Proxy)│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────┐
│  Auth   │ │  OpenClaw    │
│ Service │ │   Gateway    │
│ (Flask) │ │  (Port 18789)│
│Port 5001│ │              │
└────┬────┘ └──────────────┘
     │
     ▼
┌─────────┐
│  Redis  │
│ (Sessions)│
└─────────┘
```

---

## 📝 Configuration Files

| File | Purpose |
|------|---------|
| `/opt/mission-auth/.env` | Auth service configuration |
| `/opt/mission-auth/app.py` | Auth service code |
| `/etc/systemd/system/mission-auth.service` | Systemd service |
| `/etc/nginx/sites-available/mission.daatan.com` | Nginx config |

---

## 🔗 Related Documentation

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - General troubleshooting
- [RUNBOOK.md](RUNBOOK.md) - Operational procedures
- [SECRETS_MANAGER.md](SECRETS_MANAGER.md) - AWS Secrets setup

---

**Last Updated:** 2026-02-19  
**Version:** 2.0 (Email Authentication)
