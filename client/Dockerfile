# Stage 1: build the Vite production bundle.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# VITE_* env vars are inlined into the bundle by Vite at build time.
ARG VITE_WS_URL=http://localhost:4000
ENV VITE_WS_URL=${VITE_WS_URL}
RUN npm run build

# Stage 2: serve the static bundle with nginx.
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
