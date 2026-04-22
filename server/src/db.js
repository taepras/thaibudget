import pg from "pg";

const { Pool } = pg;

const isRemote = process.env.DATABASE_URL?.includes('render.com') ||
                 process.env.DATABASE_URL?.includes('supabase.co');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
});

export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}
