#!/bin/bash
# Renders livekit-with-keys.yaml + egress-with-keys.yaml from templates + .env
# (keys never live in the plain templates)
set -e
cd /opt/photoportugal-meet
source .env
cp livekit.yaml livekit-with-keys.yaml
printf 'keys:\n  %s: %s\nwebhook:\n  api_key: %s\n  urls:\n    - https://photoportugal.com/api/video-call/webhook\n' \
  "$LIVEKIT_API_KEY" "$LIVEKIT_API_SECRET" "$LIVEKIT_API_KEY" >> livekit-with-keys.yaml
chmod 600 livekit-with-keys.yaml
cp egress.yaml egress-with-keys.yaml
printf 'api_key: %s\napi_secret: %s\n' "$LIVEKIT_API_KEY" "$LIVEKIT_API_SECRET" >> egress-with-keys.yaml
chmod 600 egress-with-keys.yaml
echo config_rendered
