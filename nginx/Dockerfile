# Production nginx: builds the React app and serves it as static files,
# proxying /api, /admin and /ws to Django. Built from the repo root
# (see docker-compose.prod.yml) so it can reach both frontend/ and nginx/.
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM nginx:1.25-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
