# Extend OpenClaw image with docker-cli so agents can run docker build, docker run, etc.
FROM ghcr.io/openclaw/openclaw:main

USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends docker.io && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
USER node
