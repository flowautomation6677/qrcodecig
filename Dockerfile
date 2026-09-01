FROM node:20-alpine

WORKDIR /app

# Instala dependências
COPY package.json package-lock.json* ./
RUN npm install

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

# Inicia a aplicação
CMD ["npm", "start"]
