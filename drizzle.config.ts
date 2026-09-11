import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

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

const missing = [
  !host && 'SQL_HOST/CLOUD_SQL_CONNECTION_NAME',
  !user && 'SQL_USER/PGUSER',
  isCloudSqlSocket && !password && 'SQL_PASSWORD/PGPASSWORD',
  !database && 'SQL_DB_NAME/PGDATABASE',
].filter(Boolean);

if (missing.length > 0 || connectionNameInvalid || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('\nERROR: Konfigurasi PostgreSQL untuk Drizzle tidak lengkap atau tidak valid.');
  if (missing.length > 0) console.error(`Variabel yang belum diisi: ${missing.join(', ')}`);
  if (connectionNameInvalid) console.error('CLOUD_SQL_CONNECTION_NAME berisi karakter yang tidak valid.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) console.error('SQL_PORT/PGPORT harus berupa port yang valid.');
  console.error('Gunakan variabel SQL_* yang sama dengan runtime aplikasi.\n');
  process.exit(1);
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host,
    port,
    user,
    password,
    database,
  },
});
