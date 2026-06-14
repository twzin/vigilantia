# Multi-stage build: Node para compilar, Nginx para servir
FROM node:20-alpine AS build
WORKDIR /app

# VITE_GATEWAY_URL é injetado em build-time para que o bundle React saiba o endereço do gateway
ARG VITE_GATEWAY_URL=http://localhost:8000
ENV VITE_GATEWAY_URL=${VITE_GATEWAY_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Estágio final: Nginx mínimo com apenas os estáticos
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]