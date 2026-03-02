#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Obsidian Asteroid Scraper..."
bashio::log.info "Node version: $(node --version)"
bashio::log.info "NPM version: $(npm --version)"

cd /app

bashio::log.info "Launching background sync service..."
node /app/scripts/ha-sync.js &

bashio::log.info "Launching static file server on port 3000..."
# Use npx serve to serve the static export folder. 
# REMOVED -s to allow subfolders like /signage/ and /list/ to work correctly with their own index.html
npx serve out -p 3000
