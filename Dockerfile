# Image Node 20 (LTS), légère.
FROM node:20-slim

# Dossier de travail dans le conteneur.
WORKDIR /app

# 1) Dépendances : on copie package.json d'abord (cache Docker), puis on
#    installe TOUT, y compris les devDependencies (vite et esbuild servent
#    au build).
COPY package*.json ./
RUN npm install

# 2) Le reste du code.
COPY . .

# 3) Build : exactement ton script "build" (vite build -> dist/, puis
#    esbuild -> dist/server.cjs).
RUN npm run build

# 4) Production : NODE_ENV=production fait que server.ts sert les fichiers
#    construits (dist/) au lieu de lancer le serveur Vite de développement.
ENV NODE_ENV=production
EXPOSE 8080

# 5) Démarrage du serveur Express empaqueté.
CMD ["node", "dist/server.cjs"]
