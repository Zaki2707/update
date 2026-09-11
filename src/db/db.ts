import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function buildPoolConfig(): PoolConfig {
  const base: PoolConfig = {
    max: 10,
    connectionTimeoutMillis: 15000,
  };

  const connectionName = String(
    process.env.CLOUD_SQL_CONNECTION_NAME ||
    process.env.INSTANCE_CONNECTION_NAME ||
    ''
  ).trim();
  const host = String(
    process.env.SQL_HOST ||
    (connectionName ? `/cloudsql/${connectionName}` : '')
  ).trim();
  const user = String(
    process.env.SQL_USER ||
    process.env.PGUSER ||
    process.env.SQL_ADMIN_USER ||
    ''
  ).trim();
  const password = String(
    process.env.SQL_PASSWORD ||
    process.env.PGPASSWORD ||
    process.env.SQL_ADMIN_PASSWORD ||
    ''
  );
  const database = String(
    process.env.SQL_DB_NAME ||
    process.env.PGDATABASE ||
    'cloud_sql_production_database'
  ).trim();
  const port = Number(process.env.SQL_PORT || process.env.PGPORT || 5432);
  const isCloudSqlSocket = host.startsWith('/cloudsql/') || host.startsWith('/app/cloudsql/');
  const connectionNameInvalid = Boolean(connectionName && !/^[A-Za-z0-9_.:-]+$/.test(connectionName));

  if (!host || !user || (isCloudSqlSocket && !password) || !database || connectionNameInvalid ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Complete SQL_* or compatible PG* settings are required for PostgreSQL.');
  }

  return {
    ...base,
    host,
    user,
    password,
    database,
    port,
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
