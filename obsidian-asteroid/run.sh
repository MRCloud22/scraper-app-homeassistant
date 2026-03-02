#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# In Home Assistant, /addon_config is already the addon-specific directory
# (mapped from addon_configs/HASH_slug/ on the host)
# So we store files directly in /addon_config — no subdirectory needed.
CONFIG_DIR="/addon_config"
MEDIA_DIR="${CONFIG_DIR}/media"

bashio::log.info "Configuration directory: ${CONFIG_DIR}"

# Ensure media directory exists
mkdir -p "${MEDIA_DIR}"

# Provide default assets if media directory is empty
if [ -z "$(ls -A ${MEDIA_DIR} 2>/dev/null)" ]; then
    bashio::log.info "No media files found. Populating defaults into ${MEDIA_DIR}..."
    cp /app/public/defaults/*.png "${MEDIA_DIR}/" 2>/dev/null || true
fi

# Wait up to 5s for /addon_config to be mounted and accessible
for i in 1 2 3 4 5; do
    if [ -d "${CONFIG_DIR}" ]; then break; fi
    bashio::log.info "Waiting for /addon_config to be available... (${i}/5)"
    sleep 1
done

# Create default settings.json ONLY if:
#   - file doesn't exist, OR
#   - file is empty, OR
#   - file contains invalid JSON (node -e fails on parse)
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
