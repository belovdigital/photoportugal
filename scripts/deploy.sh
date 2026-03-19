#!/bin/bash
# Deploy Photo Portugal to production
# Usage: ./scripts/deploy.sh

set -e

SERVER="root@146.190.166.142"
APP_DIR="/var/www/photoportugal"

echo "🚀 Deploying Photo Portugal..."

# Push latest code
echo "→ Pushing to GitHub..."
git push origin main

# Deploy on server
echo "→ Pulling on server and rebuilding..."
ssh $SERVER "cd $APP_DIR && git pull origin main && npm install && NODE_OPTIONS='--max-old-space-size=3072' npm run build && pm2 restart photoportugal"

echo "→ Checking health..."
sleep 3
STATUS=$(ssh $SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000")

if [ "$STATUS" = "200" ]; then
  echo "✅ Deploy successful! Site is live at http://146.190.166.142"
else
  echo "❌ Deploy may have failed. HTTP status: $STATUS"
  ssh $SERVER "pm2 logs photoportugal --lines 20"
fi
