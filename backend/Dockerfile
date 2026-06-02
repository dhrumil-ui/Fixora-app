# syntax=docker/dockerfile:1.6
# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ---------- Dependencies ----------
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && cp -R node_modules /prod_node_modules
RUN npm ci --legacy-peer-deps

# ---------- Development (hot reload via nodemon) ----------
FROM base AS development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5001 9229
CMD ["dumb-init", "npm", "run", "dev"]

# ---------- Production ----------
FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=deps /prod_node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["dumb-init", "node", "src/server.js"]
