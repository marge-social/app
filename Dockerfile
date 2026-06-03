# syntax=docker/dockerfile:1

# Image Debian slim (glibc) : évite les écueils musl des modules natifs
# (@node-rs/argon2). Node 22 LTS.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# --- Dépendances complètes (pour le build) ---
FROM base AS deps
COPY package.json package-lock.json ./
# NODE_ENV=production (hérité de base) ferait sauter les devDependencies à npm ci.
# --include=dev les réintègre : nécessaires au build (@tailwindcss/postcss, etc.).
RUN npm ci --include=dev

# --- Build Next.js ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Dépendances de production uniquement ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Image finale ---
FROM base AS runner
ENV PORT=3000
# Utilisateur non-root.
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY public ./public
COPY package.json next.config.ts ./
COPY src/db/migrations ./src/db/migrations
COPY scripts/migrate.mjs ./scripts/migrate.mjs
USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
