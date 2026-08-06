import { Pool } from 'pg'
import { config } from '../config'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.POSTGRESQL_HOST,
      port: config.POSTGRESQL_PORT,
      user: config.POSTGRESQL_USERNAME,
      password: config.POSTGRESQL_PASSWORD,
      database: config.POSTGRESQL_DATABASE,
      ssl: config.POSTGRESQL_SSL ? { rejectUnauthorized: false } : undefined,
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
