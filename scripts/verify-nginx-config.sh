#!/bin/bash
# Verifies Nginx configuration syntax using a temporary container

echo "🔍 Verifying Nginx configuration..."

# Create temporary directory for dummy certs
TEMP_CERTS_DIR=$(mktemp -d)
mkdir -p "$TEMP_CERTS_DIR/live/daatan.com"

# Generate dummy self-signed certificate if real ones don't exist
if [ ! -f "certbot/conf/live/daatan.com/fullchain.pem" ]; then
    echo "⚠️  Generating dummy SSL certificates for validation..."
    openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
        -keyout "$TEMP_CERTS_DIR/live/daatan.com/privkey.pem" \
        -out "$TEMP_CERTS_DIR/live/daatan.com/fullchain.pem" \
        -subj "/CN=daatan.com" 2>/dev/null
    
    CERT_MOUNT="-v $TEMP_CERTS_DIR:/etc/letsencrypt:ro"
else
    CERT_MOUNT="-v $(pwd)/certbot/conf:/etc/letsencrypt:ro"
fi

# Verify SSL config (main config)
docker run --rm \
  -v $(pwd)/nginx-ssl.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/certbot/www:/var/www/certbot:ro \
  $CERT_MOUNT \
  nginx:alpine nginx -t

EXIT_CODE=$?

# Cleanup
rm -rf "$TEMP_CERTS_DIR"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Nginx configuration is valid."
    exit 0
else
    echo "❌ Nginx configuration is INVALID."
    exit 1
fi
