import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Em desenvolvimento, tenta conectar no localhost:6379 por padrão.
// Em produção (Coolify), certifique-se de configurar a variável REDIS_URL
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

export const campaignQueue = new Queue('campaign-queue', { connection });
