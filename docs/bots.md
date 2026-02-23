# DAATAN Bot System Documentation

This document describes the architecture, configuration, and operation of the automated forecasting bots in DAATAN.

## Overview
DAATAN uses automated bots to maintain market activity by fetching news, identifying hot topics, and creating verifiable forecasts.

### Pipeline Flow
1.  **RSS Fetching**: Bots fetch items from configured RSS feeds.
2.  **Hot Topic Detection**: Topics appearing in multiple sources within a time window (e.g., 6 hours) are identified.
3.  **LLM Deduplication**: The bot checks existing forecasts via LLM to avoid redundant topics.
4.  **Forecast Generation**: An LLM (e.g., Gemini) generates a concise, verifiable forecast based on the news topic.
5.  **Staking**: The bot automatically stakes a random amount of Confidence Units (CU) on its own forecast.
6.  **Voting**: Bots can also scan existing open forecasts and decide whether to vote (YES/NO) based on their persona.

## Configuration
Bots are configured via the `BotConfig` model in the database. Key parameters include:

-   **Persona Prompt**: Describes the bot's character (used for decision-making and text generation).
-   **News Sources**: A list of RSS feed URLs.
-   **Schedule**: `intervalMinutes` defines how often the bot runs.
-   **Activity Caps**: `maxForecastsPerDay` and `maxVotesPerDay`.
-   **LLM Model**: `modelPreference` (e.g., `google/gemini-2.0-flash-exp:free`).
-   **Tag Focus**: `tagFilter` restricts the bot to specific topics.

## Roles and Approval
Forecasts created by bots enter the system in a **Pending Approval** status. 

### Roles
-   **Admin**: Has full control over bot configurations and can approve any forecast.
-   **Approver**: A specialized role with permission to review and activate pending bot forecasts.

## Operations
Bots are triggered on a schedule (usually via GitHub Actions reaching `/api/bots/run`). 

### Useful Commands
-   **Manual Run**: Admins can trigger a specific bot via the Admin UI.
-   **Log Inspection**: Bot activities are logged in the `BotRunLog` table.
-   **Health Check**: Monitor `/api/health` to ensure the bot runner is responsive.
