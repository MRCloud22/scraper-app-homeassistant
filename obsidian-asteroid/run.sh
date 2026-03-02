#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# Ensure config directories exist in Home Assistant
bashio::log.info "Ensuring configuration directories exist..."
mkdir -p /config/obsidian_asteroid/media
mkdir -p /addon_config/obsidian_asteroid/media

# Provide default assets if not present (/config)
if [ -z "$(ls -A /config/obsidian_asteroid/media 2>/dev/null)" ]; then
    bashio::log.info "Populating default assets in /config..."
    cp /app/public/defaults/*.png /config/obsidian_asteroid/media/ 2>/dev/null || true
fi

# Provide default assets if not present (/addon_config)
if [ -d "/addon_config" ] && [ -z "$(ls -A /addon_config/obsidian_asteroid/media 2>/dev/null)" ]; then
    bashio::log.info "Populating default assets in /addon_config..."
    cp /app/public/defaults/*.png /addon_config/obsidian_asteroid/media/ 2>/dev/null || true
fi

if [ ! -f /config/obsidian_asteroid/settings.json ] && [ ! -f /addon_config/obsidian_asteroid/settings.json ]; then
    bashio::log.info "Creating default settings.json..."
    echo '{"signage2": {"title": "BEAUTYKUPPEL", "subtitle": "Therme Bad Aibling", "logo": "logo.png", "backgroundImage": "none", "heroImage": "spa-hero.png", "qrCode": "qr-code.png", "listTitle": "FREIE TERMINE HEUTE"}}' > /config/obsidian_asteroid/settings.json
fi

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching Next.js server on port 3000..."
npm start -- -p 3000
