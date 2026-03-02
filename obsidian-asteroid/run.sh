#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Using pre-built Next.js assets from Docker image..."

# Discover the real config directory
# HA maps /config via config.yaml "map: config:rw"
# The user's addon config lives at /config/addons_config/HASH_slug/
# We find it dynamically by looking for *_obsidian_asteroid
CONFIG_DIR=""
if [ -d "/config/addons_config" ]; then
    FOUND_DIR=$(find /config/addons_config -maxdepth 1 -type d -name "*_obsidian_asteroid" | head -1)
    if [ -n "$FOUND_DIR" ]; then
        CONFIG_DIR="$FOUND_DIR"
        bashio::log.info "Found config directory: ${CONFIG_DIR}"
    fi
fi

# Fallback to /addon_config if the above didn't work
if [ -z "$CONFIG_DIR" ]; then
    CONFIG_DIR="/addon_config"
    bashio::log.info "Using fallback config directory: ${CONFIG_DIR}"
fi

# Write the discovered path so Node.js scripts can read it
echo "$CONFIG_DIR" > /tmp/config_dir_path

MEDIA_DIR="${CONFIG_DIR}/media"

bashio::log.info "Configuration directory: ${CONFIG_DIR}"

# Ensure media directory exists
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
