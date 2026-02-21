#!/usr/bin/env python3
"""
Mission Control Authentication Service
Email-based authentication with verification codes
"""

import os
import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template_string, redirect, session
import redis
import requests
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv('/opt/mission-auth/.env')

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Redis connection
redis_client = redis.Redis(
    host=os.environ.get('REDIS_HOST', 'localhost'),
    port=int(os.environ.get('REDIS_PORT', 6379)),
    decode_responses=True
)

# Email whitelist (comma-separated in env)
ALLOWED_EMAILS = set(e.strip().lower() for e in os.environ.get('ALLOWED_EMAILS', 'komapc@gmail.com').split(','))

# Email service (SendGrid)
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@mission.daatan.com')

# Gateway token for Control UI
GATEWAY_TOKEN = os.environ.get('GATEWAY_TOKEN', '')

# Session timeout (24 hours)
SESSION_TIMEOUT = timedelta(hours=24)

# Code timeout (10 minutes)
CODE_TIMEOUT = timedelta(minutes=10)

# Rate limiting: max 3 code requests per email per hour
RATE_LIMIT_WINDOW = timedelta(hours=1)
RATE_LIMIT_MAX = 3

# HTML Templates
LOGIN_PAGE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Mission Control - Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
               min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
        h1 { color: #333; margin-bottom: 10px; text-align: center; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; font-size: 14px; }
        input[type="email"], input[type="text"] { width: 100%; padding: 12px; margin: 10px 0; 
                border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; font-size: 16px; }
        button { width: 100%; padding: 12px; background: #667eea; color: white; border: none; 
                border-radius: 5px; font-size: 16px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #5568d3; }
        .message { padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center; }
        .error { background: #fee; color: #c00; }
        .success { background: #efe; color: #0a0; }
        .info { background: #eef; color: #00a; }
        .back-link { text-align: center; margin-top: 20px; }
        .back-link a { color: #667eea; text-decoration: none; }
        .code-display { background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 24px; text-align: center; margin: 10px 0; }
        .token-display { background: #fff3cd; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 14px; text-align: center; margin: 10px 0; word-break: break-all; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Mission Control</h1>
        <p class="subtitle">OpenClaw Authentication</p>
        
        {% if message %}
        <div class="message {{ type }}">{{ message }}</div>
        {% endif %}
        
        {% if step == 'email' %}
        <form method="POST" action="/login">
            <input type="email" name="email" placeholder="Your email address" required>
            <button type="submit">Send Verification Code</button>
        </form>
        
        {% elif step == 'code' %}
        <form method="POST" action="/verify">
            <input type="text" name="code" placeholder="Enter 6-digit code" maxlength="6" required>
            <button type="submit">Verify & Login</button>
        </form>
        <p style="text-align: center; font-size: 12px; color: #666; margin-top: 10px;">
            Code expires in 10 minutes
        </p>
        {% endif %}
        
        {% if debug_code %}
        <div class="info" style="margin-top: 20px;">
            <strong>Debug Mode:</strong> Use this code for testing
            <div class="code-display">{{ debug_code }}</div>
            <small>Check logs: sudo journalctl -u mission-auth -f</small>
        </div>
        {% endif %}
        
        <div class="back-link">
            <a href="/">← Back to Mission Control</a>
        </div>
    </div>
</body>
</html>
'''

AUTH_SUCCESS_PAGE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
               min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 500px; text-align: center; }
        h1 { color: #333; margin-bottom: 10px; }
        .success { color: #0a0; font-size: 24px; margin-bottom: 20px; }
        .info { background: #eef; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; }
        .token-display { background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; text-align: center; margin: 10px 0; word-break: break-all; }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        .btn:hover { background: #5568d3; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Authentication Successful</h1>
        <p class="success">Welcome, {{ email }}!</p>
        
        <div class="warning">
            <strong>⚠️ Important: Gateway Token Required</strong>
            <p style="margin: 10px 0;">To connect to the OpenClaw gateway, you need to enter the token in the Control UI settings:</p>
            <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Click "Open Mission Control" below</li>
                <li>Click the ⚙️ Settings icon (bottom left)</li>
                <li>Paste the token below into "Gateway Token"</li>
                <li>Click "Save"</li>
            </ol>
        </div>
        
        <div class="info">
            <strong>🔑 Your Gateway Token:</strong>
            <div class="token-display">{{ gateway_token }}</div>
            <p style="text-align: center; margin-top: 10px;">
                <button onclick="navigator.clipboard.writeText('{{ gateway_token }}'); alert('Token copied!');" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">📋 Copy Token</button>
            </p>
        </div>
        
        <a href="/mission/" class="btn">🚀 Open Mission Control</a>
        
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
            You will be redirected in <span id="countdown">3</span> seconds...
        </p>
    </div>
    <script>
        let count = 3;
        const countdown = setInterval(() => {
            count--;
            document.getElementById('countdown').textContent = count;
            if (count <= 0) {
                clearInterval(countdown);
                window.location.href = '/mission/';
            }
        }, 1000);
    </script>
</body>
</html>
'''

def send_verification_email(email, code):
    """Send verification code via SendGrid"""
    if not SENDGRID_API_KEY:
        logger.info(f"🔐 VERIFICATION CODE for {email}: {code}")
        return True
    
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {SENDGRID_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "personalizations": [{"to": [{"email": email}]}],
        "from": {"email": FROM_EMAIL, "name": "Mission Control"},
        "subject": "Your Mission Control Verification Code",
        "content": [{
            "type": "text/plain",
            "value": f"""
Mission Control Login

Your verification code is: {code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

---
OpenClaw Mission Control
            """.strip()
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        if response.status_code == 202:
            logger.info(f"✅ Email sent to {email}")
            return True
        else:
            logger.error(f"❌ SendGrid error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Email send error: {e}")
        return False

def generate_code():
    """Generate 6-digit verification code"""
    return str(secrets.randbelow(1000000)).zfill(6)

def hash_code(code):
    """Hash code for secure storage"""
    return hashlib.sha256(code.encode()).hexdigest()

def check_rate_limit(email):
    """Check if email has exceeded rate limit. Returns True if allowed."""
    rate_key = f"rate:{email}"
    attempts = redis_client.get(rate_key)
    
    if attempts is None:
        redis_client.setex(rate_key, int(RATE_LIMIT_WINDOW.total_seconds()), 1)
        return True
    
    if int(attempts) >= RATE_LIMIT_MAX:
        return False
    
    redis_client.incr(rate_key)
    return True

@app.route('/')
def index():
    """Check if user is authenticated"""
    if 'email' in session:
        session_key = f"session:{session.get('session_id')}"
        if redis_client.exists(session_key):
            return redirect('/auth-success')
        else:
            session.clear()
    return redirect('/login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle login - email input and code sending"""
    if request.method == 'GET':
        return render_template_string(LOGIN_PAGE, step='email')

    email = request.form.get('email', '').strip().lower()

    if not email:
        return render_template_string(LOGIN_PAGE, step='email', message='Email is required', type='error')

    if email not in ALLOWED_EMAILS:
        return render_template_string(LOGIN_PAGE, step='email',
            message='Email not whitelisted. Contact administrator.', type='error')

    # Rate limiting check
    if not check_rate_limit(email):
        remaining = int(RATE_LIMIT_WINDOW.total_seconds() / 60)
        return render_template_string(LOGIN_PAGE, step='email',
            message=f'Too many attempts. Please try again in {remaining} minutes.', type='error')

    code = generate_code()
    code_key = f"code:{email}"
    redis_client.setex(code_key, int(CODE_TIMEOUT.total_seconds()), hash_code(code))
    
    if send_verification_email(email, code):
        session['pending_email'] = email
        debug_code = code if not SENDGRID_API_KEY else None
        return render_template_string(LOGIN_PAGE, step='code', 
            message=f'Verification code sent to {email}', 
            type='success',
            debug_code=debug_code)
    else:
        return render_template_string(LOGIN_PAGE, step='email', 
            message='Failed to send email. Please try again.', type='error')

@app.route('/verify', methods=['POST'])
def verify():
    """Verify code and create session"""
    email = session.get('pending_email')
    if not email:
        return redirect('/login')
    
    code = request.form.get('code', '').strip()
    if not code:
        return render_template_string(LOGIN_PAGE, step='code', 
            message='Code is required', type='error')
    
    code_key = f"code:{email}"
    stored_hash = redis_client.get(code_key)
    
    if not stored_hash or stored_hash != hash_code(code):
        return render_template_string(LOGIN_PAGE, step='code', 
            message='Invalid or expired code', type='error')
    
    redis_client.delete(code_key)
    
    session_id = secrets.token_hex(32)
    session_key = f"session:{session_id}"
    redis_client.setex(session_key, int(SESSION_TIMEOUT.total_seconds()), email)
    
    session['email'] = email
    session['session_id'] = session_id
    session.pop('pending_email', None)
    
    logger.info(f"✅ User authenticated: {email}")
    return redirect('/auth-success')

@app.route('/auth-success')
def auth_success():
    """Authentication success page with gateway token"""
    if 'email' not in session:
        return redirect('/login')
    
    return render_template_string(AUTH_SUCCESS_PAGE, 
        email=session.get('email'),
        gateway_token=GATEWAY_TOKEN)

@app.route('/logout')
def logout():
    """Logout user"""
    session_id = session.get('session_id')
    if session_id:
        redis_client.delete(f"session:{session_id}")
    session.clear()
    logger.info(f"🚪 User logged out")
    return redirect('/login')

@app.route('/mission/')
def mission_proxy():
    """Proxy to actual Mission Control (OpenClaw Gateway)"""
    if 'email' not in session:
        return redirect('/login')
    
    session_key = f"session:{session.get('session_id')}"
    if not redis_client.exists(session_key):
        session.clear()
        return redirect('/login')
    
    return redirect('http://127.0.0.1:18789')

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'redis': redis_client.ping(),
        'allowed_emails': len(ALLOWED_EMAILS),
        'gateway_token_configured': bool(GATEWAY_TOKEN)
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=False)
