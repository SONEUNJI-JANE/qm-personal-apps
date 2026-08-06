import type { PersonalApp } from '../services/api'
import { downloadAppUrl } from '../services/api'

interface Props {
  apps: PersonalApp[]
  categories: string[]
  activeCategory: string | null
  onCategorySelect: (category: string | null) => void
  onDelete: (id: number) => void
}

export function AppList({ apps, categories, activeCategory, onCategorySelect, onDelete }: Props) {
  return (
    <div>
      <div>
        <button onClick={() => onCategorySelect(null)} disabled={activeCategory === null}>전체</button>
        {categories.map(c => (
          <button key={c} onClick={() => onCategorySelect(c)} disabled={activeCategory === c}>{c}</button>
        ))}
      </div>
      <ul>
        {apps.map(app => (
          <li key={app.id}>
            <strong>{app.name}</strong> {app.category && <span>[{app.category}]</span>}
            <p>{app.description}</p>
            <small>{app.uploader_email} · {new Date(app.uploaded_at).toLocaleString('ko-KR')}</small>
            <a href={downloadAppUrl(app.id)}>다운로드</a>
            <button onClick={() => onDelete(app.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
