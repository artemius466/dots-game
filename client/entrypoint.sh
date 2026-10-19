#!/bin/sh
# Generate a runtime env file the browser fetches to learn the server address.
# The address comes from the WS_URL env var (set via docker-compose), so it can
# be changed WITHOUT rebuilding the image — just restart the container.
set -e
cat > /usr/share/nginx/html/env.json <<EOF
{"VITE_WS_URL": "${WS_URL:-http://localhost:4000}"}
EOF

exec nginx -g 'daemon off;'
