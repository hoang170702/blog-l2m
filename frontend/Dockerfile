# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS runtime
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Owned by uid 1000 (the backend's `node` user): whichever container mounts the shared
# uploads volume first sets its ownership, and the backend must be able to write to it.
RUN mkdir -p /usr/share/nginx/uploads && chown 1000:1000 /usr/share/nginx/uploads
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
