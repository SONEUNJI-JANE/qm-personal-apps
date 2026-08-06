import { useState, useEffect } from 'react'

export interface DcsUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string[]
}

const ALLOWED_ORIGINS = [
  'https://dcsai.fnf.co.kr',
  'https://dcsai-dev.fnf.co.kr',
  'http://localhost:3000',
  'http://localhost:5173',
]

export function useDcsAuth() {
  const [user, setUser] = useState<DcsUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!ALLOWED_ORIGINS.includes(event.origin)) return
      if (event.data?.type !== 'DCS_AUTH') return
      setUser(event.data.user)
      setIsLoading(false)
    }

    window.addEventListener('message', handleMessage)
    const timeout = setTimeout(() => setIsLoading(false), 5000)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timeout)
    }
  }, [])

  return { user, isLoading }
}
