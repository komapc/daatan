# Requirements Document

## Introduction

This specification defines the configuration of an OpenClaw multi-agent team ("The Clawborators") for the DAATAN project. The goal is to enable autonomous code development with human-in-the-loop (HITL) controls for production deployments, optimized for cost efficiency using Gemini API with local LLM fallback.

## Glossary

- **OpenClaw**: Multi-agent orchestration platform for AI-assisted development
- **HITL**: Human-In-The-Loop - requiring explicit human approval before executing certain actions
- **Heartbeat**: Periodic automated checks performed by agents without explicit user request
- **Agent**: An AI persona with specific role and responsibilities (Developer, QA, DevOps)
- **SOUL.md**: Global personality and ethics configuration file
- **AGENTS.md**: Project-specific operating manual for agents
- **MEMORY.md**: Long-term knowledge base for project context
- **HEARTBEAT.md**: Checklist of proactive monitoring tasks
- **Sandbox**: Isolated execution environment for shell commands

## Requirements

### Requirement 1: User Identity Configuration

**User Story:** As komap, I want the agents to know my identity and preferences, so that they can communicate appropriately and respect my schedule.

#### Acceptance Criteria

1. THE OpenClaw System SHALL store user identity as "komap" in USER.md
2. THE OpenClaw System SHALL use Israel timezone (UTC+2/+3) for all time-based operations
3. WHILE the current time is between 00:00 and 08:00 Israel time, THE OpenClaw System SHALL suppress non-urgent Telegram notifications
4. THE OpenClaw System SHALL send HITL approval requests via Telegram bot using configured API key

### Requirement 2: Agent Team Structure

**User Story:** As komap, I want a lean team of 3 specialized agents, so that I minimize token costs while maintaining clear role separation.

#### Acceptance Criteria

1. THE OpenClaw System SHALL configure exactly 3 agent roles: Developer, QA, and DevOps
2. THE Developer Agent SHALL handle all frontend (React/Tailwind) and backend (Node.js/PostgreSQL) code implementation
3. THE QA Agent SHALL execute tests, monitor logs, and verify deployments
4. THE DevOps Agent SHALL manage Docker builds, GitHub operations, and deployment workflows
5. THE OpenClaw System SHALL use gemini-1.5-flash model for QA heartbeat tasks to reduce costs

### Requirement 3: Human-In-The-Loop Controls

**User Story:** As komap, I want certain dangerous operations to require my explicit approval, so that I maintain control over production systems.

#### Acceptance Criteria

1. WHEN an agent attempts to deploy to production, THE OpenClaw System SHALL request approval via Telegram before proceeding
2. WHEN an agent attempts to run database migrations on staging or production, THE OpenClaw System SHALL request approval via Telegram before proceeding
3. WHEN an agent attempts to execute terraform apply, THE OpenClaw System SHALL request approval via Telegram before proceeding
4. THE OpenClaw System SHALL allow file deletion operations without HITL approval
5. IF an agent does not receive HITL approval within 24 hours, THEN THE OpenClaw System SHALL cancel the pending operation

### Requirement 4: Git Workflow Enforcement

**User Story:** As komap, I want agents to follow a structured git workflow, so that changes are properly tested before reaching production.

#### Acceptance Criteria

1. WHEN implementing a new feature, THE Developer Agent SHALL create a feature branch from main
2. THE QA Agent SHALL run local tests (npm test, npm run build, npm run lint) before any push
3. WHEN local tests pass, THE DevOps Agent SHALL push to staging for deployment
4. WHEN staging deployment succeeds, THE OpenClaw System SHALL notify komap via Telegram for review
5. WHEN komap approves, THE DevOps Agent SHALL merge to main and trigger production deployment
6. THE OpenClaw System SHALL never push directly to main without explicit approval

### Requirement 5: Cost Optimization

**User Story:** As komap, I want to minimize LLM API costs, so that I can run the system sustainably.

#### Acceptance Criteria

1. THE OpenClaw System SHALL use gemini-1.5-pro as the primary model for complex tasks
2. THE OpenClaw System SHALL use gemini-1.5-flash for routine monitoring and heartbeat tasks
3. WHEN Gemini API quota is exhausted, THE OpenClaw System SHALL fallback to local Ollama models
4. THE OpenClaw System SHALL include Ollama installation and configuration instructions
5. IF a task is estimated to exceed 50,000 tokens, THEN THE OpenClaw System SHALL request approval before proceeding

### Requirement 6: Proactive Monitoring (Heartbeat)

**User Story:** As komap, I want agents to proactively monitor system health, so that I'm alerted to issues before they become critical.

#### Acceptance Criteria

1. THE QA Agent SHALL check staging.daatan.com reachability every 4 hours
2. THE QA Agent SHALL check daatan.com (production) reachability every 4 hours
3. THE DevOps Agent SHALL run npm audit for security vulnerabilities daily
4. THE DevOps Agent SHALL monitor local disk space every 4 hours
5. THE DevOps Agent SHALL check SSL certificate expiry weekly
6. THE Developer Agent SHALL provide a daily morning summary of commits and pending PRs at 09:00 Israel time
7. WHILE quiet hours are active (00:00-08:00), THE OpenClaw System SHALL queue non-urgent heartbeat notifications

### Requirement 7: Configuration File Management

**User Story:** As komap, I want a hybrid configuration approach, so that personality is consistent globally while project context is specific.

#### Acceptance Criteria

1. THE OpenClaw System SHALL store SOUL.md and IDENTITY.md in ~/.openclaw/workspace/ (global)
2. THE OpenClaw System SHALL store AGENTS.md, MEMORY.md, and HEARTBEAT.md in the DAATAN repository root (per-project)
3. THE OpenClaw System SHALL commit per-project configuration files to git
4. THE per-project configuration SHALL override global configuration when conflicts exist

### Requirement 8: Security and Sandboxing

**User Story:** As komap, I want appropriate security controls, so that agents cannot accidentally damage my system.

#### Acceptance Criteria

1. THE OpenClaw System SHALL run non-main agent sessions in sandbox mode
2. THE OpenClaw System SHALL bind the gateway to 127.0.0.1 only
3. THE OpenClaw System SHALL never output contents of .env files or AWS secrets in chat
4. IF a shell command fails twice, THEN THE OpenClaw System SHALL stop and provide a diagnostic report instead of retrying
5. THE OpenClaw System SHALL use trash instead of rm for file deletions when possible

### Requirement 9: Task Intake Workflow

**User Story:** As komap, I want to give tasks via chat or TODO.md, so that I have flexible ways to direct the agents.

#### Acceptance Criteria

1. WHEN komap provides a task in chat, THE Developer Agent SHALL acknowledge and begin implementation
2. WHEN a TODO.md file exists with unchecked items, THE Developer Agent SHALL work through items in order
3. THE OpenClaw System SHALL update TODO.md to mark completed items
4. THE OpenClaw System SHALL notify komap via Telegram when a task is ready for review

### Requirement 10: Team Identity

**User Story:** As komap, I want the agent team to have a fun identity, so that interactions feel more engaging.

#### Acceptance Criteria

1. THE OpenClaw System SHALL identify the team as "The Clawborators" in IDENTITY.md
2. THE agents SHALL use "we" when referring to the team collectively
3. THE agents SHALL maintain a technical, concise, and proactive communication style
