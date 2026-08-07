import { useRef, useState } from 'react'
import { createAppRecord } from '../services/api'
import { buildStorageKey, uploadFileDirect } from '../services/storage'

interface Props {
  uploaderEmail: string
  uploaderName: string
  onUploaded: () => void
}

export function UploadForm({ uploaderEmail, uploaderName, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) {
      setError('파일과 앱 이름은 필수입니다')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const s3Key = buildStorageKey(file.name)
      await uploadFileDirect(file, s3Key)
      await createAppRecord({
        name,
        description,
        category,
        uploaderEmail,
        uploaderName,
        s3Key,
        originalFilename: file.name,
        fileSize: file.size,
      })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
      <div className="field field-file">
        <label>파일 *</label>
        <div className="file-picker">
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            파일 선택
          </button>
          <span className="file-name">{file ? file.name : '선택된 파일 없음'}</span>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div className="field field-name">
        <label>앱 이름 *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="field field-desc">
        <label>앱 설명</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="field field-category">
        <label>사용자</label>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">선택</option>
          <option value="QM">QM</option>
          <option value="TD">TD</option>
          <option value="QA">QA</option>
        </select>
      </div>
      <button type="submit" className="btn" disabled={submitting}>{submitting ? '업로드 중...' : '업로드'}</button>
      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
