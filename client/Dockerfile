# ── Stage 1: Build Vite app ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx (ultra-fast static serving) ────
FROM nginx:stable-alpine AS runner

# Replace default config with ours
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
