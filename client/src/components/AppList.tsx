import { useMemo, useState } from 'react'
import type { PersonalApp } from '../services/api'
import { downloadAppUrl } from '../services/api'
import { sortApps, SortField, SortDirection } from '../utils/sortApps'

interface Props {
  apps: PersonalApp[]
  categories: string[]
  activeCategory: string | null
  onCategorySelect: (category: string | null) => void
  onDelete: (id: number) => void
}

const COLUMNS: { field: SortField; label: string }[] = [
  { field: 'name', label: '이름' },
  { field: 'category', label: '카테고리' },
  { field: 'uploader_email', label: '올린사람' },
  { field: 'uploaded_at', label: '날짜' },
]

export function AppList({ apps, categories, activeCategory, onCategorySelect, onDelete }: Props) {
  const [sortField, setSortField] = useState<SortField>('uploaded_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedApps = useMemo(
    () => sortApps(apps, sortField, sortDirection),
    [apps, sortField, sortDirection]
  )

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  return (
    <div>
      <div className="filters">
        <button
          className={`chip${activeCategory === null ? ' active' : ''}`}
          onClick={() => onCategorySelect(null)}
        >
          전체
        </button>
        {categories.map(c => (
          <button
            key={c}
            className={`chip${activeCategory === c ? ' active' : ''}`}
            onClick={() => onCategorySelect(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {sortedApps.length === 0 ? (
          <div className="empty-state">아직 업로드된 앱이 없어요.</div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.field} style={{ cursor: 'pointer' }} onClick={() => handleSort(col.field)}>
                    {col.label}
                    {sortField === col.field ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedApps.map(app => (
                <tr key={app.id}>
                  <td>
                    <div className="app-name">
                      {app.name}
                      {app.category && <span className="category-tag">{app.category}</span>}
                    </div>
                    {app.description && <div className="app-desc">{app.description}</div>}
                  </td>
                  <td className="meta">{app.category ?? '-'}</td>
                  <td className="meta">{app.uploader_email}</td>
                  <td className="meta">{new Date(app.uploaded_at).toLocaleString('ko-KR')}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a className="link" href={downloadAppUrl(app.id)}>다운로드</a>
                    {' '}
                    <button className="btn-danger" onClick={() => onDelete(app.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
