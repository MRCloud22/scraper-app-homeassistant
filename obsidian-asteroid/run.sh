#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# Ensure config directories exist in Home Assistant
bashio::log.info "Ensuring configuration directories exist in /config..."
mkdir -p /config/obsidian_asteroid/media
if [ ! -f /config/obsidian_asteroid/settings.json ]; then
    bashio::log.info "Creating default settings.json..."
    echo '{"title": "Beauty Kuppel", "theme": "dark"}' > /config/obsidian_asteroid/settings.json
fi

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching Next.js server on port 3000..."
npm start -- -p 3000
