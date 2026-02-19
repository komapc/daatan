# OpenClaw Mission Control - Access Information

## ✅ Mission Control is Now Live!

### Primary URL (HTTPS)
```
https://mission.daatan.com
```

**Click to open:** [https://mission.daatan.com](https://mission.daatan.com)

---

## 🔐 Authentication

### User Accounts

| Username | Password | Role |
|----------|----------|------|
| `mission_user` | `OpenClaw2026!` | Admin |
| `user2` | `OpenClaw2026!` | User |
| `user3` | `OpenClaw2026!` | User |
| `user4` | `OpenClaw2026!` | User |

**To add more users:**
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184
sudo htpasswd -b /etc/nginx/.htpasswd newuser 'Password123!'
```

---

## 🔒 Security

| Feature | Status |
|---------|--------|
| HTTPS Encryption | ✅ Let's Encrypt SSL |
| Authentication | ✅ Basic Auth (htpasswd) |
| IP Restriction | ⚠️ Open (can be restricted) |
| Auto-Renew SSL | ✅ Certbot auto-renewal |

### To Restrict Access to Specific IPs

Edit nginx config:
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184
sudo nano /etc/nginx/sites-available/mission.daatan.com
```

Add inside the `server` block:
```nginx
allow 84.229.91.11;  # Your IP
allow 1.2.3.4;       # Add more IPs
deny all;            # Block everyone else
```

Then reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 📋 What You Can Do in Mission Control

| Feature | Description |
|---------|-------------|
| **WebChat** | Chat with AI agents directly from browser |
| **Session Management** | View and control active agent sessions |
| **Channel Status** | See Telegram bot status and connections |
| **Logs** | View real-time agent activity and errors |
| **Configuration** | View current configuration |

---

## 🛠️ Maintenance Commands

### Check Status
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184
cd ~/projects/openclaw

# Check bot status
docker exec openclaw npx --yes openclaw channels status

# Check container
docker compose ps

# View logs
docker compose logs -f openclaw
```

### Restart Services
```bash
# Restart OpenClaw
docker compose restart openclaw

# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

### SSL Certificate
```bash
# Check SSL expiry
sudo certbot certificates

# Manual renewal
sudo certbot renew --dry-run
```

---

## 🌐 DNS & Network

| Setting | Value |
|---------|-------|
| Domain | `mission.daatan.com` |
| Instance IP | `63.182.142.184` |
| HTTPS Port | `443` (open to all) |
| HTTP Port | `80` (redirects to HTTPS) |
| Gateway Port | `18789` (internal only) |

### DNS Record
```
mission.daatan.com.  300  IN  A  63.182.142.184
```

---

## 📧 SSL Certificate

| Property | Value |
|----------|-------|
| Provider | Let's Encrypt |
| Issued | 2026-02-19 |
| Expires | 2026-05-20 |
| Auto-Renew | ✅ Enabled |

**Certificate Location:**
- Certificate: `/etc/letsencrypt/live/mission.daatan.com/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/mission.daatan.com/privkey.pem`

---

## 🚨 Troubleshooting

### Can't Access Website

1. **Check DNS:**
   ```bash
   dig mission.daatan.com
   # Should return: 63.182.142.184
   ```

2. **Check nginx:**
   ```bash
   ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184
   sudo systemctl status nginx
   ```

3. **Check OpenClaw:**
   ```bash
   docker compose ps
   docker compose logs openclaw
   ```

### SSL Certificate Issues

```bash
# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

### Authentication Issues

```bash
# Reset password
sudo htpasswd -D /etc/nginx/.htpasswd username  # Delete user
sudo htpasswd -b /etc/nginx/.htpasswd username 'NewPassword!'  # Add user
```

---

## 📝 Configuration Files

| File | Purpose |
|------|---------|
| `/etc/nginx/sites-available/mission.daatan.com` | Nginx config |
| `/etc/nginx/.htpasswd` | User credentials |
| `/etc/letsencrypt/live/mission.daatan.com/` | SSL certificates |
| `~/projects/openclaw/.env` | OpenClaw environment |
| `~/.openclaw/openclaw.json` | OpenClaw configuration |

---

## 🔗 Related Links

- **OpenClaw Docs:** https://docs.openclaw.ai
- **GitHub Repo:** https://github.com/openclaw/openclaw
- **Let's Encrypt:** https://letsencrypt.org

---

**Last Updated:** 2026-02-19  
**Instance:** AWS EC2 t4g.medium (eu-central-1)
