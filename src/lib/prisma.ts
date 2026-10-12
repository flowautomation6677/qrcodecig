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

      ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

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
    `);
    schemaEnsured = true;
  } catch (err) {
    console.warn('Aviso: Falha ao executar migração automática do esquema:', err);
  }
}
