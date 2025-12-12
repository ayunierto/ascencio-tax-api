# syntax=docker/dockerfile:1.7

# Base image
FROM node:20-alpine AS base
WORKDIR /app
# Avoid sharp/glibc headaches and improve compatibility
RUN apk add --no-cache libc6-compat

# --- Dependencies & Build stage ---
FROM base AS builder

# Copy only files needed to install deps first (better layer caching)
COPY package.json package-lock.json turbo.json ./
# Copy workspace manifests so npm can install all workspace deps
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install all deps (including dev) at the monorepo root
RUN npm ci

# Copy the rest of the repo
COPY . .

# Build everything via Turborepo (this should build packages/shared and apps/api)
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
## API uses API_PORT; we'll map it to PORT at runtime via a tiny wrapper

# Copy production node_modules from builder
# We keep full node_modules from the builder to preserve workspace links reliably
COPY --from=builder /app/node_modules ./node_modules

# Copy only what we need to run the API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/assets ./apps/api/assets
COPY --from=builder /app/apps/api/fonts ./apps/api/fonts
# If you have other runtime files (e.g. credentials.json), copy them too
COPY --from=builder /app/apps/api/credentials.json ./apps/api/credentials.json

# Copy the shared workspace so node_modules workspace links resolve
COPY --from=builder /app/packages/shared ./packages/shared

# Expose the internal port
EXPOSE 3000

# Startup wrapper to set API_PORT from PORT if provided
RUN printf '#!/bin/sh\n' \
	'export API_PORT="${API_PORT:-${PORT:-3000}}"\n' \
	'exec node apps/api/dist/main.js\n' > /entrypoint.sh \
	&& chmod +x /entrypoint.sh

# Start the API
CMD ["/entrypoint.sh"]
