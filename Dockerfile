# --- Stage 1: Build Stage ---
FROM node:16-alpine AS builder
WORKDIR /app

# Copy application files
COPY . .

# Install dependencies and build the application
RUN yarn install --frozen-lockfile
RUN yarn build

# --- Stage 2: Final Production Stage ---
FROM node:16-alpine

# Install Chromium and necessary libraries for Puppeteer
RUN apk add --no-cache \
    chromium \
    ca-certificates \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    libstdc++ \
    bash

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy built files from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/yarn.lock .

# Install production dependencies
RUN yarn install --frozen-lockfile --production

# Expose the application port
EXPOSE 8080

# Start the application
CMD ["node", "app.js"]
