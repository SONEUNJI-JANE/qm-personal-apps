import { useState } from 'react'
import { uploadApp } from '../services/api'

interface Props {
  uploaderEmail: string
  onUploaded: () => void
}

export function UploadForm({ uploaderEmail, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) {
      setError('파일과 이름은 필수입니다')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await uploadApp(file, { name, description, category, uploaderEmail })
      setFile(null)
      setName('')
      setDescription('')
      setCategory('')
      onUploaded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="설명" value={description} onChange={e => setDescription(e.target.value)} />
      <input placeholder="카테고리 (예: TD, QA, 패턴툴)" value={category} onChange={e => setCategory(e.target.value)} />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? '업로드 중...' : '업로드'}</button>
    </form>
  )
}
