# Imagen del backend. La misma sirve para la API y para el worker:
# el comando lo define cada servicio del docker-compose, de modo que
# ambos siguen siendo procesos independientes y desplegables por separado.
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para aprovechar la cache de capas.
COPY package.json package-lock.json ./
RUN npm ci

# El cliente de Prisma se genera durante el build a partir del esquema.
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 4000

# Comando por defecto: la API. El worker lo sobrescribe en el compose.
CMD ["node", "src/api/index.js"]
