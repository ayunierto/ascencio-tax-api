# syntax=docker/dockerfile:1.7

# Base image
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat git
RUN corepack enable

# --- Dependencies stage ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# --- Runtime stage ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies prepared in builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/fonts ./fonts

# Copy credentials (optional, better via env vars in production)
# COPY credentials.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
