#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# /addon_config is the correct standard location for add-on persistent data in HA
# This directory is always available as a mounted volume for add-ons
CONFIG_DIR="/addon_config/obsidian_asteroid"
MEDIA_DIR="${CONFIG_DIR}/media"

bashio::log.info "Configuration directory: ${CONFIG_DIR}"

# Ensure configuration directories exist
mkdir -p "${MEDIA_DIR}"

# Provide default assets if the media directory is empty
if [ -z "$(ls -A ${MEDIA_DIR} 2>/dev/null)" ]; then
    bashio::log.info "No media files found. Populating defaults into ${MEDIA_DIR}..."
    cp /app/public/defaults/*.png "${MEDIA_DIR}/" 2>/dev/null || true
fi

# Create default settings.json if it doesn't exist
if [ ! -f "${CONFIG_DIR}/settings.json" ]; then
    bashio::log.info "Creating default settings.json in ${CONFIG_DIR}..."
    echo '{"signage2": {"title": "BEAUTYKUPPEL", "subtitle": "Therme Bad Aibling", "logo": "logo.png", "backgroundImage": "none", "heroImage": "spa-hero.png", "qrCode": "qr-code.png", "listTitle": "FREIE TERMINE HEUTE"}}' > "${CONFIG_DIR}/settings.json"
fi

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching Next.js server on port 3000..."
npm start -- -p 3000
