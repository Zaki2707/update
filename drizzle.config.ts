import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('\n❌ ERROR: DATABASE_URL belum diisi di file .env!');
  console.error('Silakan buat/edit file .env dan tambahkan DATABASE_URL=postgresql://...\n');
  process.exit(1);
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
