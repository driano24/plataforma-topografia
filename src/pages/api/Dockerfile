# --- ETAPA 1: Construcción (Build) ---
# Usamos una versión ligera de Node.js
FROM node:lts-alpine AS build
WORKDIR /app

# 1. Instalamos dependencias
COPY package*.json ./
RUN npm install

# 2. Copiamos todo el código fuente
COPY . .

# 3. Construimos la aplicación (genera la carpeta dist/)
RUN npm run build

# --- ETAPA 2: Producción (Runtime) ---
# Creamos una imagen limpia y ligera solo para correr la app
FROM node:lts-alpine AS runtime
WORKDIR /app

# 1. Copiamos solo lo necesario de la etapa anterior
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# 2. Copiamos los archivos de base de datos para poder ejecutar migraciones si hace falta
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

# 3. Configuramos el puerto
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# 4. Comando para iniciar VV Survey Tech
CMD ["node", "./dist/server/entry.mjs"]