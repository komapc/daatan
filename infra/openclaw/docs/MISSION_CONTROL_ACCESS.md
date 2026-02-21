# OpenClaw Mission Control - Access Information

## ✅ Mission Control is Now Live!

### Primary URL (HTTPS)
```
https://mission.daatan.com
```

**Click to open:** [https://mission.daatan.com](https://mission.daatan.com)

---

## 🔐 Authentication: Email Verification

Mission Control now uses **secure email-based authentication** with verification codes.

### How to Login

1. **Visit:** https://mission.daatan.com
2. **Enter your email** (must be whitelisted)
3. **Check your email** for a 6-digit verification code
4. **Enter the code** on the website
5. **Access granted** for 24 hours

---

## 👥 Current Whitelist

| Email | Status |
|-------|--------|
| `komapc@gmail.com` | ✅ Approved |

---

## ➕ Adding New Users

### Quick Add

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184

# Edit whitelist
sudo nano /opt/mission-auth/.env

# Add email (comma-separated)
ALLOWED_EMAILS=komapc@gmail.com,newuser@example.com

# Restart service
sudo systemctl restart mission-auth
```

### User Experience

New users will:
1. Enter their email at https://mission.daatan.com
2. Receive a 6-digit code via email
3. Enter the code to gain access
4. Stay logged in for 24 hours

---

## 📧 Email Configuration (Optional)

By default, verification codes are logged to the console. To send real emails:

### Using SendGrid

1. Get API key from https://sendgrid.com
2. Update config:
   ```bash
   sudo nano /opt/mission-auth/.env
   ```
3. Add:
   ```env
   SENDGRID_API_KEY=SG.xxxxxx.yyyyyy
   FROM_EMAIL=noreply@mission.daatan.com
   ```
4. Restart:
   ```bash
   sudo systemctl restart mission-auth
   ```

---

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| **Email Whitelist** | Only approved emails can login |
| **Verification Codes** | 6-digit codes, 10-minute expiry |
| **Session Management** | 24-hour sessions via Redis |
| **No Passwords** | Nothing to steal or forget |
| **HTTPS Only** | All traffic encrypted |

---

## 🛠️ Maintenance Commands

### Check Service Status
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184
sudo systemctl status mission-auth
```

### View Logs
```bash
# Service logs
sudo journalctl -u mission-auth -f

# Verification codes (without SendGrid)
sudo journalctl -u mission-auth | grep "VERIFICATION CODE"
```

### Health Check
```bash
curl http://127.0.0.1:5001/health
# Expected: {"status":"healthy","redis":true,"allowed_emails":1}
```

### Manage Sessions
```bash
# List active sessions
redis-cli KEYS "session:*"

# Clear all sessions (force re-login)
redis-cli KEYS "session:*" | xargs redis-cli DEL
```

---

## 🚨 Troubleshooting

### User Can't Login

1. **Check whitelist:**
   ```bash
   grep ALLOWED_EMAILS /opt/mission-auth/.env
   ```

2. **Check services:**
   ```bash
   sudo systemctl status mission-auth
   sudo systemctl status redis-server
   ```

3. **Check logs:**
   ```bash
   sudo journalctl -u mission-auth -n 50
   ```

### Code Not Received

- **Without SendGrid:** Check logs
  ```bash
  sudo journalctl -u mission-auth | grep "VERIFICATION CODE"
  ```

- **With SendGrid:** Check SendGrid dashboard

---

## 📋 What You Can Do in Mission Control

| Feature | Description |
|---------|-------------|
| **WebChat** | Chat with AI agents from browser |
| **Session Management** | View active agent sessions |
| **Channel Status** | See Telegram bot status |
| **Logs** | View real-time activity |
| **Configuration** | View current settings |

---

## 📝 Configuration Files

| File | Purpose |
|------|---------|
| `/opt/mission-auth/.env` | Auth service config |
| `/opt/mission-auth/app.py` | Auth service code |
| `/etc/nginx/sites-available/mission.daatan.com` | Nginx config |

---

## 🔗 Related Documentation

- [EMAIL_AUTH_SETUP.md](EMAIL_AUTH_SETUP.md) - Detailed auth setup
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Troubleshooting guide
- [RUNBOOK.md](RUNBOOK.md) - Operational procedures

---

**Last Updated:** 2026-02-19  
**Instance:** AWS EC2 t4g.medium (eu-central-1)  
**Auth Version:** 2.0 (Email Verification)
