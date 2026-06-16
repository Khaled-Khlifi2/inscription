/**
 * Context d'authentification ADMIN (scolarité + responsable)
 * Cloisonné : stocke dans sessionStorage avec clé 'admin_*'
 * N'a AUCUN accès aux tokens étudiant
 */
import { createContext, useContext, useState, useCallback } from 'react'

const AdminAuthCtx = createContext(null)

const KEY_TOKEN    = 'admin_token'
const KEY_ROLE     = 'admin_role'       // 'scolarite' | 'responsable'
const KEY_NIVEAU   = 'admin_niveau_id'  // pour responsable uniquement

const ALLOWED_ROLES = ['scolarite', 'responsable']

export function AdminAuthProvider({ children }) {
  const [token,    setToken]    = useState(() => sessionStorage.getItem(KEY_TOKEN))
  const [role,     setRole]     = useState(() => sessionStorage.getItem(KEY_ROLE))
  const [niveauId, setNiveauId] = useState(() => {
    const v = sessionStorage.getItem(KEY_NIVEAU)
    return v ? parseInt(v) : null
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
    setToken(t); setRole(r)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY_TOKEN)
    sessionStorage.removeItem(KEY_ROLE)
    sessionStorage.removeItem(KEY_NIVEAU)
    setToken(null); setRole(null); setNiveauId(null)
  }, [])

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
