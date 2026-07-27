# ---- Build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Runtime ----
# El bundle es estatico. nginx lo sirve y reenvia /api al API Gateway; el
# destino se resuelve al arrancar a partir de KONG_UPSTREAM, para que la misma
# imagen funcione en docker compose y en Kubernetes.
FROM nginx:alpine
ENV KONG_UPSTREAM=kong:8000
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
