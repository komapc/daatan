#!/bin/bash
set -e

# DAATAN Deployment Script
# Run this on the EC2 instance from ~/app directory

echo "🚀 DAATAN Deployment Script"
echo "==========================="

cd ~/app

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create it with: echo 'POSTGRES_PASSWORD=your_secure_password' > .env"
    exit 1
fi

# Create certbot directories
mkdir -p certbot/www certbot/conf

# Check if SSL certificates exist
if [ ! -d "certbot/conf/live/daatan.com" ]; then
    echo "📜 SSL certificates not found. Starting HTTP-only mode first..."
    
    # Start postgres first
    echo "Starting PostgreSQL..."
    docker compose -f docker-compose.prod.yml up -d postgres
    
    # Wait for postgres
    echo "Waiting for PostgreSQL to be ready..."
    sleep 15
    
    # Build and start app
    echo "Building and starting application..."
    docker compose -f docker-compose.prod.yml build app
    docker compose -f docker-compose.prod.yml up -d app
    sleep 10
    
    # Start nginx with HTTP-only config for certificate request
    echo "Starting nginx (HTTP only for SSL challenge)..."
    docker run -d --name daatan-nginx-init \
        --network daatan_default \
        -p 80:80 \
        -v ~/app/nginx-init.conf:/etc/nginx/nginx.conf:ro \
        -v ~/app/certbot/www:/var/www/certbot:ro \
        nginx:alpine || docker run -d --name daatan-nginx-init \
        --network app_default \
        -p 80:80 \
        -v ~/app/nginx-init.conf:/etc/nginx/nginx.conf:ro \
        -v ~/app/certbot/www:/var/www/certbot:ro \
        nginx:alpine
    
    sleep 5
    
    echo "🔐 Requesting SSL certificate from Let's Encrypt..."
    docker run --rm \
        -v ~/app/certbot/www:/var/www/certbot \
        -v ~/app/certbot/conf:/etc/letsencrypt \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@daatan.com \
        --agree-tos \
        --no-eff-email \
        -d daatan.com \
        -d www.daatan.com
    
    # Stop the init nginx
    echo "Stopping temporary nginx..."
    docker stop daatan-nginx-init && docker rm daatan-nginx-init
    
    echo "✅ SSL certificates obtained!"
else
    echo "✅ SSL certificates already exist"
fi

echo ""
echo "🐳 Starting all services with HTTPS..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "🧹 Cleaning up old images..."
docker image prune -f

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Services running:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "🌐 Your site should be available at:"
echo "   https://daatan.com"
echo "   https://www.daatan.com"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "   Restart:       docker compose -f docker-compose.prod.yml restart"
echo "   Stop:          docker compose -f docker-compose.prod.yml down"
