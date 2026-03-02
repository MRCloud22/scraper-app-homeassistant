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
COPY obsidian-asteroid/package*.json ./
RUN npm install
RUN npm install -g serve

# Copy application source
COPY obsidian-asteroid/ .

# Create initial data placeholder to prevent 404s
RUN mkdir -p public && echo '{"appointments":[],"count":0,"lastUpdated":""}' > public/appointments.json
COPY . .

# Build the Next.js application
RUN npm run build

# Make the run script executable
RUN chmod a+x /app/run.sh

# Entrypoint is the run script
CMD [ "/app/run.sh" ]
