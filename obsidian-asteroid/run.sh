#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# Prioritize /addon_config if available, otherwise use /config
CONFIG_BASE="/config"
if [ -d "/addon_config" ]; then
    CONFIG_BASE="/addon_config"
fi

bashio::log.info "Using configuration base: ${CONFIG_BASE}"

# Ensure configuration directories exist
mkdir -p /config/obsidian_asteroid/media
mkdir -p /addon_config/obsidian_asteroid/media

# Provide default assets if not present
if [ -z "$(ls -A ${CONFIG_BASE}/obsidian_asteroid/media 2>/dev/null)" ]; then
    bashio::log.info "Populating default assets in ${CONFIG_BASE}..."
    cp /app/public/defaults/*.png ${CONFIG_BASE}/obsidian_asteroid/media/ 2>/dev/null || true
fi

# Create default settings.json in the preferred base if none exists in either
if [ ! -f /config/obsidian_asteroid/settings.json ] && [ ! -f /addon_config/obsidian_asteroid/settings.json ]; then
    bashio::log.info "Creating default settings.json in ${CONFIG_BASE}..."
    echo '{"signage2": {"title": "BEAUTYKUPPEL", "subtitle": "Therme Bad Aibling", "logo": "logo.png", "backgroundImage": "none", "heroImage": "spa-hero.png", "qrCode": "qr-code.png", "listTitle": "FREIE TERMINE HEUTE"}}' > ${CONFIG_BASE}/obsidian_asteroid/settings.json
fi

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching Next.js server on port 3000..."
npm start -- -p 3000
