FROM ghcr.io/puppeteer/puppeteer:21.5.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true\
    PUPPETEER_EXCUTABLE_PATH=/usr/bin/google-chrome-stable


WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY ..
CMD ["npm", "start"]