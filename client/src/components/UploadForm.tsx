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
    <form className="card upload-form" onSubmit={handleSubmit}>
      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <label>파일</label>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="field">
        <label>이름 *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: 패턴요청 자동회신" />
      </div>
      <div className="field">
        <label>설명</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="간단한 설명" />
      </div>
      <div className="field">
        <label>카테고리</label>
        <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="예: TD, QA, 패턴툴" />
      </div>
      <button type="submit" className="btn" disabled={submitting}>{submitting ? '업로드 중...' : '업로드'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
