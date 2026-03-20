FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Use ci for reproducible installs, only production deps
RUN npm ci --only=production --prefer-offline

COPY . .

# Copy the Vite build from the client (when built in the same docker-compose context)
COPY ../client/dist ./client/dist

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "server.js"]
