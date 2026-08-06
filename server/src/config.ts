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

  S3_API_BASE_URL: z.string().default('https://aviyup1kyk.execute-api.ap-northeast-2.amazonaws.com/prod'),
  S3_API_KEY: z.string(),
  S3_BUCKET: z.string().default('svc-fnf-ax-platform-pub-s3'),
})

export const config = envSchema.parse(process.env)
