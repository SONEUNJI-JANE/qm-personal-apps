export interface PersonalApp {
  id: number
  name: string
  description: string | null
  category: string | null
  s3_key: string
  original_filename: string
  file_size: number
  uploader_email: string
  uploader_name: string | null
  uploaded_at: Date
}

export interface CreatePersonalAppDto {
  name: string
  description: string | null
  category: string | null
  s3_key: string
  original_filename: string
  file_size: number
  uploader_email: string
  uploader_name: string | null
}
