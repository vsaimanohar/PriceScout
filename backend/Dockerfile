FROM node:18-slim

# Install Chrome dependencies for Puppeteer and build tools for SQLite
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  chromium \
  build-essential \
  python3 \
  make \
  g++ \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set working directory
WORKDIR /app

# Copy package files  
COPY package*.json ./

# Install dependencies fresh in container
RUN npm install

# Copy app files (excluding node_modules and database)
COPY . ./
RUN rm -rf node_modules database.db

# Fresh install and rebuild for Linux architecture
RUN npm install && npm rebuild sqlite3

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]