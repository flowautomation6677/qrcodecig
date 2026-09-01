# Conexão WhatsApp QR Code (Evolution API)

Aplicação Next.js para gerenciamento e sincronização de conexões WhatsApp via **Evolution API**.

## Recursos

- **Atualização Automática do QR Code**: O QR code é renovado a cada **10 segundos** de forma contínua com barra de progresso visual.
- **Detecção em Tempo Real (Polling 3s)**: Verifica a cada 3 segundos se o WhatsApp foi escaneado e atualiza a interface instantaneamente.
- **Proxy Seguro no Backend**: A chave global (`EVOLUTION_API_KEY`) nunca é exposta no frontend.
- **Parâmetros de URL Flexíveis**: Suporte para carregar a instância automaticamente via `/?instance=sua_instancia` ou formulário manual.
- **Pronto para Deploy no Coolify**: Contém Dockerfile otimizado multi-stage.

## Variáveis de Ambiente

Crie um arquivo `.env.local` para desenvolvimento local ou configure no Coolify:

```env
EVOLUTION_API_URL=https://sua-api-evolution.com
EVOLUTION_API_KEY=SuaChaveGlobalDaEvolution
```

## Como Rodar Localmente

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) ou [http://localhost:3000/?instance=5511999999999](http://localhost:3000/?instance=5511999999999).

## Deploy no Coolify

1. No Coolify, crie uma nova aplicação a partir do repositório Git.
2. Na aba **Environment Variables**, adicione:
   - `EVOLUTION_API_URL`
   - `EVOLUTION_API_KEY`
3. O Coolify detectará o `Dockerfile` automaticamente.
4. Clique em **Deploy**.
