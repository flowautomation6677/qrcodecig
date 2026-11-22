FROM node:20-alpine

# Pacotes essenciais para Prisma e Node no Alpine Linux
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Instala dependências com tolerância a peer dependencies
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copia o código-fonte
COPY . .

# Build de produção do Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Porta da aplicação
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# Muda para o usuário não-root por segurança
USER node

# Inicia a aplicação
CMD ["npm", "start"]
