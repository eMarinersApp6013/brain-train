# BrainPing - SaaS Brain Training Platform

A WhatsApp-based brain training platform that delivers daily cognitive challenges, tracks progress, and gamifies mental fitness.

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Admin Panel │    │  Main Server │    │ User Portal  │
│  Port 4200   │    │  Port 3000   │    │  Port 4201   │
│  (Express)   │    │  (Express)   │    │  (Express)   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL  │
                    │  12 Tables   │
                    └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  Chatwoot  │ │Claude │ │  OpenAI   │
        │ WhatsApp   │ │  API  │ │   API     │
        └───────────┘ └───────┘ └───────────┘
```

## Features

- **7 Daily Challenge Types**: Logic, Words, Math Speed, Pattern, Memory, Trivia, Riddle
- **10 Engagement Modules**: Brain Age Test, IQ Estimation, Speed Challenge, Friend Duel, Cognitive Profile, Personal Coach, Badges, Leaderboard, Spaced Recall, Brain Health Score
- **Kids Mode**: 3 age groups (6-9, 10-13, 14-17) with age-appropriate content
- **WhatsApp Integration**: All communication via Chatwoot API
- **Dual AI**: Claude for content generation, OpenAI for answer checking
- **Admin Panel**: Full dashboard, question management, AI generator, user management
- **User Portal**: Progress tracking, calendar view, assessments, badges, leaderboard
- **Gamification**: Streaks, points, badges, weekly leaderboard, brain health score
- **Test Mode**: Whitelist-based testing before public launch

## Quick Start

```bash
# Install dependencies
cd server && npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Set up database
psql -U postgres -c "CREATE DATABASE brainping;"
psql -U postgres -d brainping -f database/schema.sql
psql -U postgres -d brainping -f database/seeds.sql

# Start server
node server/index.js
```

## Services

| Port | Service | URL |
|------|---------|-----|
| 3000 | Webhook Server | `POST /webhook/chatwoot` |
| 4200 | Admin Panel | `http://localhost:4200` |
| 4201 | User Portal | `http://localhost:4201` |

## WhatsApp Commands

| Command | Description |
|---------|-------------|
| MENU | List all commands |
| STATS | Personal score summary |
| HINT | Get a clue (-1 point) |
| PAUSE/RESUME | Toggle daily messages |
| LEVEL | Change difficulty |
| PREMIUM | See plan options |
| BRAIN AGE | Take brain age test |
| IQ | IQ estimation (Premium) |
| DUEL +91XXX | Challenge a friend |
| LEADERBOARD | Weekly top 10 |
| BADGES | Your achievements |
| REPORT | Weekly brain report |
| STOP | Unsubscribe |

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Messaging**: Chatwoot API (WhatsApp Business)
- **AI**: Anthropic Claude + OpenAI
- **Scheduler**: node-cron
- **Frontend**: Vanilla HTML/CSS/JS (single-file apps)

## Documentation

- [Deployment Guide](docs/deployment.md)
- [API Reference](docs/api.md)
- [Content Pipeline](docs/content_pipeline.md)
