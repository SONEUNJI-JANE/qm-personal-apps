import { app } from './app'
import { config } from './config'
import { getPool } from './db/pool'
import { SCHEMA_SQL } from './db/schema'

async function main() {
  await getPool().query(SCHEMA_SQL)

  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`)
  })
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
