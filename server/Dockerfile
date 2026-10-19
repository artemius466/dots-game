# Authoritative Socket.io server for the Dots game.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci

# Copy source. "npm start" runs `tsx src/index.ts` (tsx is a devDependency).
COPY . .

# Container port for HTTP + Socket.IO. Override with --env PORT=.
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "start"]
