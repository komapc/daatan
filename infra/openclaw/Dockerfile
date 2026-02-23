# Extend OpenClaw image with docker-cli and LAN binding support
FROM ghcr.io/openclaw/openclaw:main

USER root
RUN apt-get update && \
  apt-get install -y --no-install-recommends docker.io && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Create wrapper script that adds --bind lan when OPENCLAW_GATEWAY_BIND=lan
RUN cat > /usr/local/bin/start-gateway.sh <<'EOF'
#!/bin/sh
set -e

cd /app

# Check if we should bind to LAN
if [ "$OPENCLAW_GATEWAY_BIND" = "lan" ]; then
  exec node openclaw.mjs gateway --bind lan
else
  exec node openclaw.mjs gateway
fi
EOF
RUN chmod +x /usr/local/bin/start-gateway.sh

USER node
WORKDIR /app
ENTRYPOINT ["/usr/local/bin/start-gateway.sh"]
