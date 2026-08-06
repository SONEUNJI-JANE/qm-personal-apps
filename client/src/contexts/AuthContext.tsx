import { createContext, useContext, ReactNode } from 'react'
import { useDcsAuth, DcsUser } from '../hooks/useDcsAuth'

interface AuthContextType {
  user: DcsUser | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useDcsAuth()
  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
