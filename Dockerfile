# Dockerfile
FROM public.ecr.aws/docker/library/node:20-slim

# yt-dlp needs python3 if we use the script variant; also ffmpeg + curl
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp (script variant; now python3 is present)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && /usr/local/bin/yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]




