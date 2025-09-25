# Use AWS ECR Public mirror to avoid Docker Hub/GHCR auth limits
FROM public.ecr.aws/docker/library/node:20-slim

# Minimal deps for yt-dlp + ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Latest yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# App
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]



