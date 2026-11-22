import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
export const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let schemaEnsured = false;

export async function ensureDatabaseSchema() {
  if (schemaEnsured) return;
  try {
    // 1. Garante tabela Client e chave estrangeira
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Client" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "instanceName" TEXT NOT NULL,
        "phoneNumber" TEXT,
        "status" TEXT NOT NULL DEFAULT 'disconnected',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "Client_slug_key" ON "Client"("slug");
      CREATE UNIQUE INDEX IF NOT EXISTS "Client_instanceName_key" ON "Client"("instanceName");

      -- Campos da API Oficial da Meta no Client
      ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'evolution';
      ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "metaPhoneNumberId" TEXT;
      ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "metaWabaId" TEXT;
      ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "metaAccessToken" TEXT;

      -- Colunas adicionadas na Campaign para clientes e cadência contínua
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'evolution';
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "metaTemplateName" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "metaTemplateLanguage" TEXT DEFAULT 'pt_BR';
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "metaTemplateComponents" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'America/Sao_Paulo';
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "allowedDays" TEXT DEFAULT '[1,2,3,4,5]';
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "windowsJson" TEXT DEFAULT '[]';
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "dailyLimit" INTEGER DEFAULT 0;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "validateWhatsApp" BOOLEAN DEFAULT true;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "stopGroupOnSuccess" BOOLEAN DEFAULT true;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "keepTitles" BOOLEAN DEFAULT false;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "dedupDays" INTEGER DEFAULT 30;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "allowedDdds" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "pauseReason" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "nextDispatchAt" TIMESTAMP(3);
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "currentSlot" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "currentSlotCount" INTEGER DEFAULT 0;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "todayDate" TEXT;
      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "todayCount" INTEGER DEFAULT 0;

      -- Colunas adicionadas no Contact para deduplicação, múltiplos números e locks
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "normalizedPhone" TEXT DEFAULT '';
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "contactGroupKey" TEXT;
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "variablesJson" TEXT;
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "metaMessageId" TEXT;
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "metaStatus" TEXT;

      -- Índices de performance
      CREATE INDEX IF NOT EXISTS "Contact_normalizedPhone_idx" ON "Contact"("normalizedPhone");
      CREATE INDEX IF NOT EXISTS "Contact_contactGroupKey_idx" ON "Contact"("contactGroupKey");
      CREATE INDEX IF NOT EXISTS "Campaign_status_nextDispatchAt_idx" ON "Campaign"("status", "nextDispatchAt");

      -- Foreign key para Client
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Campaign_clientId_fkey'
        ) THEN 
          ALTER TABLE "Campaign" 
          ADD CONSTRAINT "Campaign_clientId_fkey" 
          FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE; 
        END IF; 
      END $$;

      -- Backfill não-destrutivo para preservar dados de campanhas antigas
      UPDATE "Contact" 
      SET "normalizedPhone" = "number" 
      WHERE "normalizedPhone" IS NULL OR "normalizedPhone" = '';

      UPDATE "Campaign"
      SET "nextDispatchAt" = COALESCE("scheduledAt", "createdAt")
      WHERE "nextDispatchAt" IS NULL;
    `);

    schemaEnsured = true;
    console.log('[Database] Esquema PostgreSQL sincronizado com sucesso (todas as colunas e dados preservados).');
  } catch (err) {
    console.warn('Aviso: Falha ao executar migração automática do esquema:', err);
  }
}
