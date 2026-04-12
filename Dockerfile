# syntax=docker/dockerfile:1.7

# Base image
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat git
RUN corepack enable

# --- Dependencies stage ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# --- Runtime stage ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/fonts ./fonts

# Copy credentials (optional, better via env vars in production)
# COPY credentials.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
