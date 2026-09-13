# Multi-stage build: compile TypeScript, then run slim node image.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# edge-tts (free TTS) is a python CLI
RUN apk add --no-cache python3 py3-pip \
  && pip install --no-cache-dir --break-system-packages edge-tts

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm install --global --no-save --package-lock=false tsx@4.23.13

COPY --from=builder /app/dist ./dist
COPY src ./src
COPY scripts ./scripts
COPY knowledge-base ./knowledge-base
COPY public ./public

EXPOSE 3000

CMD ["node", "dist/server.js"]