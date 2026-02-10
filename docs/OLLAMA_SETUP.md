# Setting up Ollama (Gwen/Qwen) on Infrastructure

To enable the fallback LLM capability, we use **Ollama** running **Qwen 2.5 7B** (referred to as "Gwen").

## 1. System Requirements

*   **RAM**: At least 8GB total system RAM (Qwen 7B takes ~5-6GB).
*   **Disk**: ~5GB for the model weights.
*   **CPU**: AVX2 support (standard on most modern EC2s).

*Recommended EC2*: `t3.xlarge` (4 vCPU, 16GB RAM) or `m5.xlarge`.

## 2. Docker Compose Configuration

Add the `ollama` service to your `docker-compose.yml` (or `docker-compose.prod.yml`):

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: daatan-ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434" # Internal network only, or expose if needed (secure it!)
    networks:
      - app_network

volumes:
  ollama_data:
```

## 3. Pulling the Model

Ollama starts empty. You must pull the model **once** after the container starts.

**On the server:**

```bash
# 1. Start the container
docker compose up -d ollama

# 2. Pull the model (this downloads ~4.7GB)
docker exec -it daatan-ollama ollama pull qwen2.5:7b

# 3. Verify it works
docker exec -it daatan-ollama ollama list
# You should see 'qwen2.5:7b'
```

## 4. Environment Variables

Update the main application (`daatan-app`) environment variables to point to Ollama:

```env
# If running in the same Docker network:
OLLAMA_BASE_URL=http://ollama:11434

# If running on host/external:
# OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## 5. Verification

Check the logs when the app starts. If Gemini fails, you should see logs indicating a fallback attempt:
`"Provider Gemini failed: ..."` followed by `"Attempting generation with provider: Ollama"`.
