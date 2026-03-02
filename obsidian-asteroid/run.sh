#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# Config directory: /config is mapped via "map: config:rw" in config.yaml
# and accessible via Samba share "config" on the host.
# We use a subdirectory to keep things organized.
CONFIG_DIR="/config/obsidian_asteroid"
MEDIA_DIR="${CONFIG_DIR}/media"

bashio::log.info "Configuration directory: ${CONFIG_DIR}"

# Ensure directories exist
mkdir -p "${MEDIA_DIR}"

# Provide default assets if media directory is empty
if [ -z "$(ls -A ${MEDIA_DIR} 2>/dev/null)" ]; then
    bashio::log.info "No media files found. Populating defaults into ${MEDIA_DIR}..."
    cp /app/public/defaults/*.png "${MEDIA_DIR}/" 2>/dev/null || true
fi

# Create default settings.json ONLY if missing, empty, or invalid
NEEDS_DEFAULT=false
if [ ! -f "${CONFIG_DIR}/settings.json" ]; then
    bashio::log.info "settings.json not found — creating default."
    NEEDS_DEFAULT=true
elif [ ! -s "${CONFIG_DIR}/settings.json" ]; then
    bashio::log.info "settings.json is empty — creating default."
    NEEDS_DEFAULT=true
elif ! node -e "JSON.parse(require('fs').readFileSync('${CONFIG_DIR}/settings.json','utf8'))" 2>/dev/null; then
    bashio::log.info "settings.json contains invalid JSON — recreating default."
    NEEDS_DEFAULT=true
else
    bashio::log.info "settings.json found and valid — keeping existing file."
fi

if [ "$NEEDS_DEFAULT" = "true" ]; then
    echo '{"signage2": {"title": "BEAUTYKUPPEL", "subtitle": "Therme Bad Aibling", "logo": "logo.png", "backgroundImage": "none", "heroImage": "spa-hero.png", "qrCode": "qr-code.png", "listTitle": "FREIE TERMINE HEUTE"}}' > "${CONFIG_DIR}/settings.json"
    bashio::log.info "Default settings.json created."
fi

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching Next.js server on port 3000..."
npm start -- -p 3000
