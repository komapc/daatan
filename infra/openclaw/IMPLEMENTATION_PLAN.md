# OpenClaw Implementation Plan

**Created:** 2026-02-18  
**Status:** Ready for implementation  
**Priority:** P1 (High)

---

## Executive Summary

Based on review of recent OpenClaw documentation and community best practices, this plan outlines implementation improvements for our EC2 deployment.

**Key Findings:**
1. OpenClaw has evolved significantly - new gateway architecture, session model, sandbox security
2. Qwen2.5 offers excellent cost/performance for fallback (0.5B-72B range, Apache 2.0 for most)
3. Current config uses deprecated patterns (fallbacks array → provider rotation)
4. Script organization needs improvement for maintainability

---

## 1. Script Organization

### Current Structure
```
infra/openclaw/
├── scripts/
│   ├── raise-openclaw.sh
│   ├── destroy-openclaw.sh
│   └── setup-on-ec2.sh
```

### Recommended Structure
```
infra/openclaw/
├── scripts/
│   ├── provision/
│   │   ├── create.sh           # Was: raise-openclaw.sh
│   │   ├── destroy.sh          # Was: destroy-openclaw.sh
│   │   └── terraform/
│   │       ├── init.sh
│   │       ├── apply.sh
│   │       └── destroy.sh
│   ├── setup/
│   │   ├── on-ec2.sh           # Was: setup-on-ec2.sh
│   │   ├── clone-repos.sh
│   │   ├── bootstrap-agents.sh
│   │   └── validate-env.sh
│   └── utils/
│       ├── backup-env.sh
│       ├── restore-env.sh
│       └── health-check.sh
├── ansible/                     # NEW: Optional Ansible playbooks
│   ├── provision.yml
│   └── roles/
└── docs/
    ├── RUNBOOK.md              # NEW: Operational procedures
    └── TROUBLESHOOTING.md      # Extracted from DEPLOYMENT_PLAN.md
```

### Rationale

| Directory | Purpose |
|-----------|---------|
| `provision/` | Infrastructure creation/destruction (Terraform wrapper) |
| `setup/` | Post-provision configuration (idempotent, can re-run) |
| `utils/` | Operational utilities (backup, health checks) |
| `ansible/` | Optional: Configuration management for multi-instance |
| `docs/` | Operational documentation separate from deployment plan |

### Migration Plan

1. **Phase 1:** Rename existing scripts (backward compatible with symlinks)
2. **Phase 2:** Extract common functions into `scripts/lib/`
3. **Phase 3:** Add new utilities (backup, health check)
4. **Phase 4:** Optional Ansible for complex setups

---

## 2. Configuration Improvements

### Current Issues

| Issue | Current | Recommended |
|-------|---------|-------------|
| Fallback pattern | `fallbacks: ["ollama/qwen:1.5b"]` | Provider rotation with auth profiles |
| Ollama config | Manual JSON | Auto-discovery via `OLLAMA_API_KEY` |
| Model selection | Single model per agent | Context-aware model routing |
| Security | No sandbox | `sandbox.mode: "non-main"` |
| Browser control | Not configured | Enabled for DevOps agent |

### New Configuration Pattern

```json
{
  "$schema": "https://openclaw.ai/schema/v2.json",
  "version": "2026.2",
  
  "gateway": {
    "bind": "0.0.0.0:18789",
    "auth": {
      "mode": "password",
      "allowTailscale": false
    },
    "tailscale": {
      "mode": "off"
    }
  },

  "models": {
    "providers": {
      "anthropic": {
        "apiKey": "${ANTHROPIC_API_KEY}",
        "subscription": "pro"
      },
      "google": {
        "apiKey": "${GEMINI_API_KEY}"
      },
      "ollama": {
        "baseUrl": "http://host.docker.internal:11434/v1",
        "apiKey": "ollama-local",
        "api": "openai-responses",
        "autoDiscover": true
      }
    },
    "routing": {
      "default": "google/gemini-1.5-pro",
      "complex": "anthropic/claude-opus-4-6",
      "fallback": "ollama/qwen2.5:3b"
    }
  },

  "agents": {
    "list": ["daatan", "calendar"],
    "defaults": {
      "workspace": "/workspace",
      "sandbox": {
        "mode": "non-main"
      },
      "model": {
        "primary": "routing.default",
        "complex": "routing.complex",
        "fallback": "routing.fallback"
      }
    }
  },

  "agents.daatan": {
    "identity": {
      "name": "Corvus",
      "theme": "DAATAN forecasting platform",
      "emoji": "🔮"
    },
    "workspace": "/workspace/daatan",
    "skills": {
      "managed": ["docker", "terraform", "github-actions"],
      "workspace": ["daatan-deploy"]
    },
    "browser": {
      "enabled": true,
      "color": "#FF4500"
    }
  },

  "agents.calendar": {
    "identity": {
      "name": "Calendar Agent",
      "theme": "YearWheel (Vite, TypeScript)",
      "emoji": "📅"
    },
    "workspace": "/workspace/year-shape",
    "skills": {
      "managed": ["vite", "typescript", "cloudflare-pages"]
    }
  },

  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "streamMode": "partial",
      "accounts": {
        "daatan": {
          "name": "Daatan",
          "botToken": "${TELEGRAM_BOT_TOKEN_DAATAN}"
        },
        "calendar": {
          "name": "Calendar",
          "botToken": "${TELEGRAM_BOT_TOKEN_CALENDAR}"
        }
      },
      "bindings": {
        "accountId:daatan": "agent:daatan",
        "accountId:calendar": "agent:calendar"
      }
    }
  },

  "browser": {
    "enabled": true,
    "headless": true,
    "maxConcurrent": 2
  },

  "security": {
    "sandbox": {
      "enabled": true,
      "mode": "non-main",
      "dockerSocket": "/var/run/docker.sock"
    }
  }
}
```

### Key Changes

| Feature | Benefit |
|---------|---------|
| Provider rotation | Automatic failover between API keys |
| Model routing | Context-aware model selection (cheap for simple, pro for complex) |
| Sandbox mode | Security isolation for untrusted operations |
| Browser control | DevOps agent can perform web actions |
| Auto-discovery | Simpler Ollama setup |

---

## 3. Qwen Model Strategy

### Recommended Model Assignment

Based on Qwen2.5 characteristics and our use cases:

| Agent | Primary | Fallback | Rationale |
|-------|---------|----------|-----------|
| **Corvus (main)** | `google/gemini-1.5-pro` | `ollama/qwen2.5:7b` | 7B balances quality/speed for general tasks |
| **DevOps** | `google/gemini-1.5-pro` | `ollama/qwen2.5:3b` | 3B sufficient for scripted operations |
| **QA** | `google/gemini-1.5-flash` | `ollama/qwen2.5:1.5b` | 1.5B fast for test running, health checks |
| **Calendar** | `google/gemini-1.5-pro` | `ollama/qwen2.5:3b` | 3B good for Vite/TypeScript assistance |

### RAM Requirements (t4g.medium: 4GB total)

| Model | RAM | Concurrent | Remaining |
|-------|-----|------------|-----------|
| qwen2.5:0.5b | 398MB | 2-3 | ~3GB |
| qwen2.5:1.5b | 986MB | 1-2 | ~2.5GB |
| qwen2.5:3b | 1.9GB | 1 | ~1.5GB |
| qwen2.5:7b | 4.7GB | 1 | ❌ Exceeds available |

**Recommendation:** Use **qwen2.5:3b** as maximum for t4g.medium. Scale to t4g.large (8GB) for 7B models.

### Configuration for Qwen Fallbacks

```json
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://host.docker.internal:11434/v1",
        "apiKey": "ollama-local",
        "api": "openai-responses",
        "models": [
          {
            "id": "qwen2.5:3b",
            "name": "Qwen 2.5 3B",
            "contextWindow": 32768,
            "maxOutput": 4096,
            "useFor": ["fallback", "simple-tasks"]
          },
          {
            "id": "qwen2.5:1.5b",
            "name": "Qwen 2.5 1.5B",
            "contextWindow": 32768,
            "maxOutput": 2048,
            "useFor": ["qa", "health-checks"]
          }
        ]
      }
    }
  },
  "agents": {
    "daatan": {
      "model": {
        "primary": "google/gemini-1.5-pro",
        "fallback": "ollama/qwen2.5:3b"
      }
    },
    "qa": {
      "model": {
        "primary": "google/gemini-1.5-flash",
        "fallback": "ollama/qwen2.5:1.5b"
      }
    }
  }
}
```

### Performance Expectations

| Model | Tokens/sec | First Token | Best For |
|-------|------------|-------------|----------|
| qwen2.5:0.5b | ~50 | <100ms | Health checks, simple Q&A |
| qwen2.5:1.5b | ~30 | ~200ms | QA tests, status queries |
| qwen2.5:3b | ~15 | ~500ms | Code assistance, debugging |
| qwen2.5:7b | ~8 | ~1s | Complex reasoning (if RAM allows) |

---

## 4. Implementation Phases

### Phase 1: Script Reorganization (Week 1)

- [ ] Create new directory structure
- [ ] Move existing scripts with symlinks for backward compatibility
- [ ] Extract common functions to `scripts/lib/`
- [ ] Add `backup-env.sh` and `restore-env.sh`
- [ ] Create `docs/RUNBOOK.md`

### Phase 2: Configuration Update (Week 2)

- [ ] Update `unified.json` to v2 schema
- [ ] Implement provider rotation
- [ ] Configure model routing
- [ ] Enable sandbox mode
- [ ] Add browser control for DevOps

### Phase 3: Qwen Integration (Week 3)

- [ ] Update Ollama to pull qwen2.5:3b and qwen2.5:1.5b
- [ ] Update user_data.sh for new models
- [ ] Configure per-agent fallbacks
- [ ] Test fallback path (disable Gemini, verify Qwen works)
- [ ] Performance benchmark

### Phase 4: Security Hardening (Week 4)

- [ ] Enable sandbox mode in production
- [ ] Configure Tailscale for secure access (optional)
- [ ] Add CloudWatch alarms
- [ ] Implement fail2ban
- [ ] Enable unattended upgrades

### Phase 5: Monitoring & Observability (Week 5)

- [ ] Add health check endpoint monitoring
- [ ] Configure structured logging
- [ ] Set up token usage tracking
- [ ] Create Grafana dashboard (optional)
- [ ] Add alerting for anomalies

---

## 5. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Script reorganization breaks deploy | High | Keep symlinks, test both paths |
| New config incompatible | High | Test in staging first, keep old config backup |
| Qwen models too slow | Medium | Benchmark before switching, keep Gemini primary |
| Sandbox breaks agent functionality | Medium | Test each agent's workflows in sandbox mode |
| RAM exhaustion with multiple models | High | Use `ollama ps` monitoring, auto-unload idle models |

---

## 6. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Deploy time | ~15 min | <10 min |
| Fallback activation | Manual | Automatic |
| Model cost/month | ~$20 | ~$15 (30% via Qwen) |
| Security incidents | 0 | 0 (maintain) |
| Mean time to recover | ~1 hour | <30 min |

---

## 7. Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize phases** based on available time
3. **Create implementation tickets** for each phase
4. **Set up staging environment** for testing
5. **Begin Phase 1** (script reorganization)

---

## References

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Ollama Setup Guide](https://www.getopenclaw.ai/help/ollama-local-models-setup)
- [Qwen2.5 Models](https://ollama.com/library/qwen2.5)
- [OpenClaw Config Schema](https://github.com/openclaw/openclaw/blob/main/docs/CONFIGURATION.md)
