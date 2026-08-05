# Build en dos etapas: se compila con Node y se sirve con nginx.

# --- Etapa 1: compilar la SPA ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Vite incrusta las variables VITE_* en tiempo de build, no las lee en
# ejecucion: por eso la URL de la API entra como ARG y no como variable
# de entorno del contenedor.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# --- Etapa 2: servir los archivos estaticos ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
