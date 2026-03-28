# BrainPing Deployment Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- PM2 (for production)
- Nginx (reverse proxy)
- Chatwoot instance with WhatsApp Business API connected

## Architecture

Single subdomain with path-based routing:
```
brain.nodesurge.tech/           → User Portal (port 4201)
brain.nodesurge.tech/admin      → Admin Panel (port 4200)
brain.nodesurge.tech/webhook    → Webhook Server (port 3000)
```

## Step 1: DNS Setup

Add one A record in your domain DNS panel:
```
brain.nodesurge.tech  →  A  →  YOUR_VPS_IP
```

## Step 2: Clone and Install

```bash
cd ~
git clone https://github.com/eMarinersApp6013/brain-train.git
cd brain-train
git checkout claude/build-brainping-saas-5oWyV
cd server && npm install && cd ..
```

## Step 3: Database Setup

```bash
# Create database (skip if already exists)
psql -U postgres -c "CREATE DATABASE brainping;"

# Run schema
psql -U postgres -d brainping -f database/schema.sql

# Seed test data
psql -U postgres -d brainping -f database/seeds.sql
```

## Step 4: Environment File

```bash
cp .env.example server/.env
nano server/.env
```

Fill in all values:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=brainping
DB_USER=postgres
DB_PASSWORD=YOUR_DB_PASSWORD

ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
SESSION_SECRET=GENERATE_A_RANDOM_STRING_HERE

ADMIN_PORT=4200
PORTAL_PORT=4201
MAIN_PORT=3000

CHATWOOT_URL=https://chat.nordsurge.tech
CHATWOOT_TOKEN=YOUR_CHATWOOT_API_TOKEN
CHATWOOT_INBOX_ID=3
CHATWOOT_ACCOUNT_ID=1

ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY
OPENAI_API_KEY=YOUR_OPENAI_KEY

TIMEZONE=Asia/Kolkata
NODE_ENV=production
```

## Step 5: Nginx Configuration

Create nginx config:
```bash
sudo nano /etc/nginx/sites-available/brain.nodesurge.tech
```

Paste this:
```nginx
server {
    listen 80;
    server_name brain.nodesurge.tech;

    # Webhook endpoint (Chatwoot sends messages here)
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin panel
    location /admin {
        proxy_pass http://localhost:4200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin panel API
    location /api/admin {
        proxy_pass http://localhost:4200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # User portal API
    location /api/portal {
        proxy_pass http://localhost:4201;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # User portal (default - everything else)
    location / {
        proxy_pass http://localhost:4201;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/brain.nodesurge.tech /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d brain.nodesurge.tech
```

This auto-updates the nginx config to handle HTTPS.

## Step 7: Start Application

```bash
cd ~/brain-train
pm2 start server/index.js --name brainping --time
pm2 save
pm2 startup  # auto-start on reboot
```

## Step 8: Configure Chatwoot Webhook

1. Go to https://chat.nordsurge.tech
2. Settings → Integrations → Webhooks → New
3. URL: `https://brain.nodesurge.tech/webhook/chatwoot`
4. Enable: `message_created` only
5. Save

## Step 9: Verify Everything

```bash
# Check server is running
pm2 status

# Check all 3 ports
curl http://localhost:3000/health
curl http://localhost:4200
curl http://localhost:4201

# Check external access
curl https://brain.nodesurge.tech/
curl https://brain.nodesurge.tech/admin
```

## URL Summary

| URL | Purpose |
|-----|---------|
| `https://brain.nodesurge.tech` | User Portal (login with phone) |
| `https://brain.nodesurge.tech/admin` | Admin Panel (login with password) |
| `https://brain.nodesurge.tech/webhook/chatwoot` | Chatwoot Webhook (internal) |
| `https://chat.nordsurge.tech` | Chatwoot Dashboard |

## Monitoring

```bash
pm2 status          # Check process status
pm2 logs brainping  # View live logs
pm2 monit           # Real-time CPU/Memory monitoring
```

## Auto-Deploy on Git Push

```bash
# Create deploy script
cat > ~/deploy-brainping.sh << 'SCRIPT'
#!/bin/bash
cd ~/brain-train
git pull origin claude/build-brainping-saas-5oWyV
cd server && npm install
pm2 restart brainping
echo "Deploy complete!"
SCRIPT
chmod +x ~/deploy-brainping.sh
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| Webhook not receiving | Verify Chatwoot webhook URL, check `pm2 logs` |
| Messages not sending | Check CHATWOOT_TOKEN in settings table |
| AI not working | Verify API keys in settings table |
| Admin login fails | Check ADMIN_PASSWORD in server/.env |
| Database errors | Verify DB_* vars in server/.env |
| 502 Bad Gateway | Run `pm2 status`, restart if crashed |
| SSL errors | Re-run `sudo certbot --nginx -d brain.nodesurge.tech` |
