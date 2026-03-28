# BrainPing Deployment Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- PM2 (for production)
- Chatwoot instance with WhatsApp Business API connected

## Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/eMarinersApp6013/brain-training.git
cd brain-training
cd server && npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your actual values:
# - Database credentials
# - Chatwoot URL and API token
# - AI API keys (Anthropic + OpenAI)
# - Admin password
# - Session secret
```

### 3. Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE brainping;"

# Run migrations
psql -U postgres -d brainping -f database/schema.sql

# Seed test data
psql -U postgres -d brainping -f database/seeds.sql
```

### 4. Start Server
```bash
# Development
node server/index.js

# Production with PM2
pm2 start server/index.js --name brainping --time
pm2 save
```

## Service Ports
- **3000**: Main server (webhook endpoint)
- **4200**: Admin panel
- **4201**: User portal

## Nginx Reverse Proxy

```nginx
# Admin Panel
server {
    listen 80;
    server_name admin.nodesurge.tech;
    location / {
        proxy_pass http://localhost:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# User Portal
server {
    listen 80;
    server_name app.nodesurge.tech;
    location / {
        proxy_pass http://localhost:4201;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Webhook
server {
    listen 80;
    server_name webhook.nodesurge.tech;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Chatwoot Webhook Setup
1. Go to https://chat.nordsurge.tech
2. Settings → Integrations → Webhooks → New
3. URL: `https://webhook.nodesurge.tech/webhook/chatwoot`
4. Enable: `message_created` only

## Auto-Deploy on Git Push
```bash
# On VPS, create a simple deploy script:
#!/bin/bash
cd /path/to/brain-training
git pull origin main
cd server && npm install
pm2 restart brainping
```

## Monitoring
```bash
pm2 status          # Check process status
pm2 logs brainping  # View logs
pm2 monit           # Real-time monitoring
```

## Troubleshooting
- **Webhook not receiving**: Check Chatwoot webhook URL and ensure port 3000 is accessible
- **Messages not sending**: Verify CHATWOOT_TOKEN in settings table
- **AI not working**: Check API keys in settings table
- **Database connection**: Verify DB_* environment variables
