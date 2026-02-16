#!/bin/bash
# Run this ON THE PRODUCTION SERVER (e.g. in ~/app) to verify auth/nginx setup
# when sign-in fails with OAuthCallback / "Session check failed".
#
# Usage: ./scripts/verify-auth-server.sh

set -e

echo "🔍 Auth/server verification (run from ~/app on prod)"
echo ""

# 1. Check nginx config has auth pass-through
echo "1. Checking nginx-ssl.conf for location /api/auth/..."
if grep -q 'location /api/auth/' nginx-ssl.conf 2>/dev/null; then
  AUTH_BLOCK=$(grep -A22 'location /api/auth/' nginx-ssl.conf 2>/dev/null | head -22)
  if echo "$AUTH_BLOCK" | grep -q 'add_header Cache-Control'; then
    echo "   ✅ location /api/auth/ present with Cache-Control-only add_header (Set-Cookie preserved)"
  elif echo "$AUTH_BLOCK" | grep -q 'add_header'; then
    echo "   ❌ location /api/auth/ has add_header other than Cache-Control - Set-Cookie may be stripped!"
  else
    echo "   ✅ location /api/auth/ present, no add_header (good)"
  fi
else
  echo "   ❌ location /api/auth/ NOT FOUND - nginx config may be old. Deploy latest nginx-ssl.conf and reload nginx."
fi
echo ""

# 2. Test nginx config inside container
echo "2. Testing nginx config (docker exec nginx -t)..."
if docker compose -f docker-compose.prod.yml exec -T nginx nginx -t 2>&1; then
  echo "   ✅ Nginx config is valid"
else
  echo "   ❌ Nginx config invalid or container not running"
fi
echo ""

# 3. Recent app logs for NextAuth errors
echo "3. Recent NextAuth/auth errors from app container (last 50 lines):"
docker logs daatan-app --tail 100 2>&1 | grep -i -E "NextAuth|auth|OAuth|callback|CALLBACK|state|cookie" || echo "   (no matching lines)"
echo ""

# 4. AUTH_TRUST_HOST in app
echo "4. Checking app env for AUTH_TRUST_HOST..."
docker exec daatan-app env 2>/dev/null | grep -E "AUTH_TRUST_HOST|NEXTAUTH_URL" || echo "   (could not read env)"
echo ""

echo "Done. If location /api/auth/ was missing, deploy the latest repo (or copy nginx-ssl.conf) and run:"
echo "  docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload"
