ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js, npm, chromium and its dependencies (Alpine uses apk)
RUN \
  apk add --no-cache \
  nodejs \
  npm \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

# Tell Puppeteer to skip downloading Chromium
# Alpine installs chromium as 'chromium-browser'
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install
RUN npm install -g serve

# Copy application source
COPY . .

# Create initial data placeholder to prevent 404s
RUN mkdir -p public && echo '{"appointments":[],"count":0,"lastUpdated":""}' > public/appointments.json
COPY . .

# 1. Build the Next.js application for static export (FTP Sync)
# We move API folder temporarily because static export fails with dynamic routes
RUN mv src/app/api /tmp/api_backup && \
  NEXT_PUBLIC_EXPORT=true npm run build && \
  mv /tmp/api_backup src/app/api && \
  mv .next_export /tmp/static_export_backup

# 2. Build the Next.js application for server mode (HA UI) 
# Clear .next cache to ensure no interference from the static build metadata
RUN rm -rf .next && npm run build

# 3. Restore static export
RUN mv /tmp/static_export_backup .next_export

# The static export will be in .next_export/ (controlled by distDir in next.config.ts)
# Standard Next.js behavior for 'output: export' puts files in 'out' folder.

# Make the run script executable
RUN chmod a+x /app/run.sh

# Entrypoint is the run script
CMD [ "/app/run.sh" ]
