import { Pool } from 'pg'
import { PersonalApp, CreatePersonalAppDto } from '../types'

export class PersonalAppsRepository {
  constructor(private pool: Pool) {}

  async create(dto: CreatePersonalAppDto): Promise<PersonalApp> {
    const result = await this.pool.query<PersonalApp>(
      `insert into personal_apps
          (name, description, category, s3_key, original_filename, file_size, uploader_email, uploader_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, name, description, category, s3_key, original_filename,
                 file_size, uploader_email, uploader_name, uploaded_at`,
      [dto.name, dto.description, dto.category, dto.s3_key, dto.original_filename, dto.file_size, dto.uploader_email, dto.uploader_name]
    )
    return result.rows[0]
  }

  async list(category?: string): Promise<PersonalApp[]> {
    if (category) {
      const result = await this.pool.query<PersonalApp>(
        `select id, name, description, category, s3_key, original_filename,
                file_size, uploader_email, uploader_name, uploaded_at
         from personal_apps
         where category = $1
         order by uploaded_at desc
         limit 500`,
        [category]
      )
      return result.rows
    }

    const result = await this.pool.query<PersonalApp>(
      `select id, name, description, category, s3_key, original_filename,
              file_size, uploader_email, uploader_name, uploaded_at
       from personal_apps
       order by uploaded_at desc
       limit 500`
    )
    return result.rows
  }

  async findById(id: number): Promise<PersonalApp | null> {
    const result = await this.pool.query<PersonalApp>(
      `select id, name, description, category, s3_key, original_filename,
              file_size, uploader_email, uploader_name, uploaded_at
       from personal_apps
       where id = $1`,
      [id]
    )
    return result.rows[0] ?? null
  }

  async remove(id: number): Promise<void> {
    await this.pool.query('delete from personal_apps where id = $1', [id])
  }
}
