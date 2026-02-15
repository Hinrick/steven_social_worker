# OpenClaw Social Worker Bot — Project Documentation

## Overview

Discord bot system for **彰化縣私立慈美老人長期照顧中心** (Changhua Private Ci-Mei Elderly Long-Term Care Center). Helps social workers generate two types of Word documents per client:

- **A05 個案動態記錄表** — Monthly dynamic record (filled every month, 12 entries/year)
- **A04 個案服務計畫記錄表** — Quarterly service plan (7 sections: basic info, assessments, family, treatment plan, quarterly tracking, family discussions)

Social workers interact via Discord (through OpenClaw AI agent), provide bullet-point notes, and AI generates professional Chinese narratives, then outputs `.docx` files.

## Architecture

```
Discord User
    ↓ @蛋蛋小助理
OpenClaw Gateway (Node.js, systemd service on server)
    ↓ AI agent uses curl
REST API (Express, Docker container, port 3456)
    ↓
PostgreSQL (Docker container)
    ↓
AI Generation (Anthropic/Gemini API) + Word Document Generation (docx npm)
```

## Tech Stack

- **Runtime**: Node.js 22 / TypeScript
- **Database**: PostgreSQL 16 (Drizzle ORM)
- **API**: Express.js (port 3456)
- **AI**: Google Gemini API (via OpenClaw agent) + Anthropic Claude API (for narrative generation in REST API)
- **Documents**: `docx` npm package for .docx generation
- **Discord**: OpenClaw AI agent platform (connects to Discord as 蛋蛋小助理)
- **Deployment**: Docker Compose (API + PostgreSQL) + systemd (OpenClaw gateway)

## Server Details

- **Server**: 152.42.211.244 (DigitalOcean, Ubuntu 24.10)
- **SSH**: `root@152.42.211.244`
- **Docker**: Rootless Docker under `deployer` user
- **OpenClaw config**: `/root/.openclaw/openclaw.json`
- **OpenClaw workspace**: `/root/.openclaw/workspace/`
- **OpenClaw logs**: `/tmp/openclaw/openclaw-*.log`
- **API Docker path**: `/home/deployer/openclaw-bot/`

## Discord Bot

- **Bot name**: 蛋蛋小助理#2219
- **Bot ID**: 1472468848279294095
- **Guild ID**: 1472469275330740326
- **Channel ID**: 1472469275821346828
- **User (hinrick) Discord ID**: 806721351331086407

## Database

- **Connection**: `postgresql://openclaw:openclaw@postgres:5432/openclaw`
- **Facility ID**: `e6873e23-384d-4fa8-b037-495385c6c133`
- **User (張社工) ID**: `279dc02a-2da7-43ec-969f-788ae8112912`

### Schema Tables

| Table | Purpose |
|-------|---------|
| `facilities` | Organization info (name, address) |
| `users` | Discord-linked social workers (discord_user_id, role, facility_id) |
| `clients` | Resident cases (case_number, name, gender, DOB, case_open_date) |
| `monthly_records` | A05 monthly records (visit_types, visit_content AI-generated, prompt_notes) |
| `client_assessments` | A04 sections 2-5 (physiological/psychological/social + AI analysis + treatment plan JSONB) |
| `client_family_members` | Family member types with counts |
| `quarterly_followups` | 4 quarterly tracking slots per year |
| `family_discussions` | 2 semi-annual discussion slots per year |
| `generated_documents` | Audit trail for generated .docx files |
| `ai_generation_log` | Full prompt/response audit trail |

## REST API Endpoints

Base URL: `http://localhost:3456/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients?facilityId=&search=` | Search clients |
| GET | `/clients/:id` | Get client details |
| POST | `/clients` | Create client |
| GET | `/clients/:id/monthly/:year` | List monthly records |
| POST | `/clients/:id/monthly/:year/:month` | Create monthly record (AI generates narrative) |
| GET | `/clients/:id/quarterly/:year` | List quarterly followups |
| POST | `/clients/:id/quarterly/:year/:quarter` | Create quarterly followup |
| GET | `/clients/:id/family/:year` | List family discussions |
| POST | `/clients/:id/family/:year/:half` | Create family discussion |
| GET/POST | `/clients/:id/assessment/:year` | Get/create assessment |
| GET | `/clients/:id/generate/a05/:year` | Generate A05 .docx |
| GET | `/clients/:id/generate/a04/:year` | Generate A04 .docx |
| GET | `/clients/:id/status/:year` | Year progress dashboard |
| GET | `/facilities` | List facilities |
| GET | `/health` | Health check |

## Key Files

```
src/
├── ai/
│   ├── claude-client.ts          # Anthropic SDK wrapper
│   ├── generate.ts               # Unified AI generation + audit logging
│   └── prompts/
│       ├── monthly-narrative.ts   # A05 visit content prompt
│       ├── quarterly-tracking.ts  # A04 Section 6
│       ├── family-discussion.ts   # A04 Section 7
│       ├── assessment-analysis.ts # A04 Section 4
│       └── treatment-plan.ts      # A04 Section 5 (JSON output)
├── api/
│   ├── server.ts                 # Express server (port 3456)
│   └── routes.ts                 # All REST API endpoints
├── bot/                          # Legacy Discord bot code (replaced by OpenClaw)
│   ├── client.ts
│   ├── deploy-commands.ts
│   ├── chat-handler.ts
│   ├── commands/                 # Slash commands (no longer registered)
│   ├── interactions/             # Modal/button/select handlers
│   ├── middleware/auth.ts
│   └── session.ts
├── db/
│   ├── schema.ts                 # Drizzle ORM schema (all tables + enums)
│   └── connection.ts             # PostgreSQL connection pool
├── documents/
│   ├── a05-generator.ts          # Builds A05 .docx (12-month table)
│   ├── a04-generator.ts          # Builds A04 .docx (7 sections)
│   └── docx-engine.ts            # Shared table/checkbox utilities
├── utils/
│   ├── roc-year.ts               # ROC ↔ AD date conversion (民國年)
│   ├── constants.ts              # Visit type labels, family member labels
│   └── logger.ts                 # Pino logger
├── env.ts                        # Zod env validation
└── index.ts                      # Entry point (bot mode)
```

## Build & Run

### Development
```bash
npm install
npm run dev          # tsx watch mode
```

### Docker (Production API)
```bash
# On server as deployer user:
cd /home/deployer/openclaw-bot
docker compose up -d --build
```

### Database
```bash
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## OpenClaw Configuration

### Config: `~/.openclaw/openclaw.json`
- **Model**: `google/gemini-2.5-flash` (switched from Anthropic due to credit issues)
- **API Key**: `GEMINI_API_KEY` in env section
- **Discord**: enabled, allowlist policy, requireMention in guilds
- **Gateway**: loopback only, port 18789, systemd service

### Workspace: `~/.openclaw/workspace/AGENTS.md`
- Instructs the AI agent (in Chinese) about all API endpoints
- Agent uses `curl` via Bash tool to call `http://localhost:3456/api`
- Includes workflow guides for creating records and generating documents

### Custom Skill: `~/.openclaw/workspace/skills/openclaw-api/SKILL.md`
- Registered as `/openclaw_api` command

### Daemon Management
```bash
openclaw daemon start     # Start gateway
openclaw daemon stop      # Stop gateway
openclaw daemon restart   # Restart gateway
openclaw daemon status    # Check status
openclaw health           # Quick health check
openclaw channels status --probe  # Check Discord connection
```

## Implementation Timeline

1. **Project scaffold** — package.json, tsconfig, Docker Compose, env validation
2. **Database schema** — Drizzle ORM with all tables for A04/A05 data
3. **Discord bot skeleton** — discord.js client, slash commands, auth middleware
4. **AI integration** — Claude client, 5 prompt templates for different document sections
5. **Document generators** — A05 (12-month table) and A04 (7-section) .docx builders
6. **REST API conversion** — Express server exposing all operations as HTTP endpoints
7. **Server deployment** — Docker containers on 152.42.211.244, freed disk space (95%→90%)
8. **OpenClaw integration** — Installed OpenClaw, configured Discord channel, workspace with API instructions
9. **Gemini switch** — Changed from Anthropic (no credits) to Google Gemini API

## Important Notes

- **ROC dates**: 民國年 + 1911 = 西元年 (e.g., ROC 115 = AD 2026)
- **All AI narratives** start with "案主" and use professional social work language in 繁體中文
- **Checkboxes** in documents use Unicode ■ (checked) / □ (unchecked)
- **Old slash commands** were deregistered from Discord (OpenClaw handles all interaction now)
- **Message Content Intent** must be enabled in Discord Developer Portal for guild messages
- **Server Members Intent** recommended for allowlist name-to-ID matching
- The `src/bot/` directory contains legacy code from the original Discord.js bot (before OpenClaw migration)
