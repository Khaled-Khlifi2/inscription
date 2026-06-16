import { createContext, useContext, useState, useCallback } from 'react'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [role,  setRole]  = useState(() => localStorage.getItem('role'))

  const login = useCallback((t, r) => {
    localStorage.setItem('token', t)
    localStorage.setItem('role',  r)
    setToken(t); setRole(r)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setToken(null); setRole(null)
  }, [])

  return (
    <AuthCtx.Provider value={{ token, role, login, logout, isAuth: !!token }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
