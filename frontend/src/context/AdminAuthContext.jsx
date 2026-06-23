/**
 * Context d'authentification ADMIN (scolarité + responsable)
 * Cloisonné : stocke dans sessionStorage avec clé 'admin_*'
 * N'a AUCUN accès aux tokens étudiant
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AdminAuthCtx = createContext(null)

const KEY_TOKEN    = 'admin_token'
const KEY_ROLE     = 'admin_role'       // 'scolarite' | 'responsable'
const KEY_NIVEAU   = 'admin_niveau_id'  // pour responsable uniquement
const KEY_SESSION_ID = 'admin_session_id'  // pour synchronisation entre onglets

const ALLOWED_ROLES = ['scolarite', 'responsable']

export function AdminAuthProvider({ children }) {
  const [token,    setToken]    = useState(() => sessionStorage.getItem(KEY_TOKEN))
  const [role,     setRole]     = useState(() => sessionStorage.getItem(KEY_ROLE))
  const [niveauId, setNiveauId] = useState(() => {
    const v = sessionStorage.getItem(KEY_NIVEAU)
    return v ? parseInt(v) : null
  })
  const [sessionId, setSessionId] = useState(() => {
    const id = sessionStorage.getItem(KEY_SESSION_ID)
    if (id) return id
    const newId = Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    sessionStorage.setItem(KEY_SESSION_ID, newId)
    return newId
  })

  const login = useCallback((t, r, extraNiveauId = null) => {
    // Sécurité : refuser si le rôle est étudiant
    if (!ALLOWED_ROLES.includes(r)) {
      console.warn('[AdminAuth] Rôle non autorisé refusé:', r)
      return
    }
    sessionStorage.setItem(KEY_TOKEN, t)
    sessionStorage.setItem(KEY_ROLE,  r)
    if (extraNiveauId) {
      sessionStorage.setItem(KEY_NIVEAU, String(extraNiveauId))
      setNiveauId(extraNiveauId)
    }
    // Signaler aux autres onglets via localStorage
    localStorage.setItem(KEY_SESSION_ID, sessionId)
    setToken(t); setRole(r)
  }, [sessionId])

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY_TOKEN)
    sessionStorage.removeItem(KEY_ROLE)
    sessionStorage.removeItem(KEY_NIVEAU)
    localStorage.removeItem(KEY_SESSION_ID)
    setToken(null); setRole(null); setNiveauId(null)
  }, [])

  // Synchronisation entre onglets via localStorage (partagé entre onglets)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === KEY_SESSION_ID && e.newValue && e.newValue !== sessionId) {
        // Un autre onglet s'est connecté avec un sessionId différent
        logout()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [sessionId, logout])

  return (
    <AdminAuthCtx.Provider value={{
      token, role, niveauId,
      login, logout,
      isAuth:        !!token && ALLOWED_ROLES.includes(role),
      isScolarite:   role === 'scolarite',
      isResponsable: role === 'responsable',
    }}>
      {children}
    </AdminAuthCtx.Provider>
  )
}

export const useAdminAuth = () => useContext(AdminAuthCtx)
