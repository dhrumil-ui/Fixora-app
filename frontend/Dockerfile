# syntax=docker/dockerfile:1.6
# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# ---------- Development (Vite dev server with HMR) ----------
FROM base AS development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
# --host 0.0.0.0 is CRITICAL inside Docker, otherwise Vite only binds to localhost
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- Build ----------
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_STRIPE_PUBLIC_KEY
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build

# ---------- Production (nginx serving dist/) ----------
FROM nginx:1.27-alpine AS production
RUN addgroup -g 1001 -S nginxuser && adduser -S nginxuser -u 1001 -G nginxuser
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R nginxuser:nginxuser /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown nginxuser:nginxuser /var/run/nginx.pid
USER nginxuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
