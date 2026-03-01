ARG BUILD_FROM
FROM $BUILD_FROM

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
COPY package.json package-lock.json ./

# Install project dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Make the run script executable
RUN chmod a+x /app/run.sh

# Entrypoint is the run script
CMD [ "/app/run.sh" ]
