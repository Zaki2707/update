import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function buildPoolConfig(): PoolConfig {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const base: PoolConfig = {
    max: 10,
    connectionTimeoutMillis: 15000,
  };

  if (databaseUrl) {
    return {
      ...base,
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    };
  }

  // Legacy/local compatibility only. Production deployment should use DATABASE_URL.
  const host = String(process.env.SQL_HOST || '').trim();
  const user = String(process.env.SQL_USER || '').trim();
  const password = String(process.env.SQL_PASSWORD || '');
  const database = String(process.env.SQL_DB_NAME || '').trim();

  if (!host || !user || !database) {
    throw new Error('DATABASE_URL is required unless complete local SQL_* settings are provided.');
  }

  return {
    ...base,
    host,
    user,
    password,
    database,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
