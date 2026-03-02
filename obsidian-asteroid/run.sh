#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# Ensure config directories exist in Home Assistant
bashio::log.info "Ensuring configuration directories exist in /config..."
mkdir -p /config/obsidian_asteroid/media

# Provide default assets if not present
if [ -z "$(ls -A /config/obsidian_asteroid/media)" ]; then
    bashio::log.info "Populating default spa assets..."
    cp /app/public/defaults/*.png /config/obsidian_asteroid/media/
fi

if [ ! -f /config/obsidian_asteroid/settings.json ]; then
    bashio::log.info "Creating default settings.json..."
    echo '{"signage2": {"title": "BEAUTYKUPPEL", "subtitle": "Therme Bad Aibling", "logo": "logo.png", "backgroundImage": "none", "heroImage": "spa-hero.png", "qrCode": "qr-code.png", "listTitle": "FREIE TERMINE HEUTE"}}' > /config/obsidian_asteroid/settings.json
fi

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching Next.js server on port 3000..."
npm start -- -p 3000
