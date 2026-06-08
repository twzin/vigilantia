# Multi-stage build (Prática de DevSecOps para reduzir o tamanho da imagem final)
FROM node:20-alpine as build
WORKDIR /app

# Copia os arquivos de dependência e instala (o npm roda DENTRO do container)
COPY package*.json ./
RUN npm install

# Copia o resto do código e faz o build (O Vite gera a pasta /app/dist)
COPY . .
RUN npm run build

# Estágio final: Nginx limpo e seguro apenas com os arquivos estáticos
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta 80 para o cluster Kubernetes
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]