# Use Node's official slim image (has Debian + Node in one)
FROM node:20-slim

# Install ffmpeg and curl (for yt-dlp), keep image small
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# App files
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
# Render injects PORT; default here is fine
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]

