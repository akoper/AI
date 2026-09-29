# Multi-stage Dockerfile for Next.js standalone application on Google Cloud Run

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV GEMINI_MODEL="gemini-2.5-flash"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create persistent data directory with permissions for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy built artifacts from standalone output
COPY --from=builder /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure sql.js WebAssembly binary is present in the standalone container
RUN mkdir -p /app/node_modules/sql.js/dist /app/public
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/sql.js/dist/sql-wasm.wasm /app/node_modules/sql.js/dist/sql-wasm.wasm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/sql.js/dist/sql-wasm.wasm /app/public/sql-wasm.wasm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/sql.js/dist/sql-wasm.wasm /app/sql-wasm.wasm

# Switch to non-root user
USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
