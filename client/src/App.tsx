import { useEffect, useState, useCallback, useMemo } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { listApps, deleteApp, PersonalApp } from './services/api'
import { filterApps } from './utils/filterApps'
import { UploadForm } from './components/UploadForm'
import { AppList } from './components/AppList'

function AppContent() {
  const { user, isLoading } = useAuth()
  const [apps, setApps] = useState<PersonalApp[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const refresh = useCallback(() => {
    listApps().then(setApps).catch(console.error)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const categories = useMemo(
    () => Array.from(new Set(apps.map(a => a.category).filter((c): c is string => !!c))),
    [apps]
  )

  const visibleApps = useMemo(() => filterApps(apps, activeCategory), [apps, activeCategory])

  const handleDelete = async (id: number) => {
    await deleteApp(id)
    refresh()
  }

  if (isLoading) return <div className="page">Loading...</div>
  if (!user?.email) return <div className="page">DCS AI 인증 정보를 받지 못했습니다.</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>QM 개인앱 아카이브</h1>
        <p>팀원들이 만든 도구를 올리고 받아가는 곳</p>
      </div>
      <UploadForm uploaderEmail={user.email} onUploaded={refresh} />
      <AppList
        apps={visibleApps}
        categories={categories}
        activeCategory={activeCategory}
        onCategorySelect={setActiveCategory}
        onDelete={handleDelete}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
