FROM node:20-alpine AS builder

WORKDIR /app

# Supports Railway build context from repo root with Dockerfile Path: frontend/Dockerfile
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
