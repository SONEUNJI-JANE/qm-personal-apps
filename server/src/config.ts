import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  CORS_ORIGIN: z.string().default('*'),

  POSTGRESQL_HOST: z.string(),
  POSTGRESQL_PORT: z.string().transform(Number).default('5432'),
  POSTGRESQL_USERNAME: z.string(),
  POSTGRESQL_PASSWORD: z.string(),
  POSTGRESQL_DATABASE: z.string(),
  POSTGRESQL_SSL: z.string().transform(v => v === 'true').default('false'),

  SUPABASE_URL: z.string(),
  SUPABASE_KEY: z.string(),
  SUPABASE_STORAGE_BUCKET: z.string().default('personal-apps'),
})

export const config = envSchema.parse(process.env)
