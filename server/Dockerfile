FROM node:24-slim

RUN apt-get update && apt-get install -y ffmpeg fontconfig && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY fonts ./fonts

# Register the bundled fonts with fontconfig so libass (via ffmpeg's ass filter)
# can actually resolve fontName values instead of silently falling back to a
# default font that matches neither the preset config nor the client preview.
RUN mkdir -p /usr/share/fonts/truetype/velora \
  && cp fonts/*.ttf /usr/share/fonts/truetype/velora/ \
  && fc-cache -f

EXPOSE 5000

CMD ["node", "src/app.js"]