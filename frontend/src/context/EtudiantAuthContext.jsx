/**
 * Context d'authentification ÉTUDIANT
 * Cloisonné : stocke dans sessionStorage avec clé 'etudiant_*'
 * N'a AUCUN accès aux tokens admin/scolarité/responsable
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const EtudiantAuthCtx = createContext(null)

const KEY_TOKEN = 'etudiant_token'
const KEY_ROLE  = 'etudiant_role'    // toujours 'etudiant'
const KEY_SESSION_ID = 'etudiant_session_id'  // pour synchronisation entre onglets

export function EtudiantAuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(KEY_TOKEN))
  const [role,  setRole]  = useState(() => sessionStorage.getItem(KEY_ROLE))
  const [sessionId, setSessionId] = useState(() => {
    const id = sessionStorage.getItem(KEY_SESSION_ID)
    if (id) return id
    const newId = Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    sessionStorage.setItem(KEY_SESSION_ID, newId)
    return newId
  })

  const login = useCallback((t, r) => {
    // Sécurité : refuser si le rôle n'est pas étudiant
    if (r !== 'etudiant') {
      console.warn('[EtudiantAuth] Tentative de connexion avec rôle non-étudiant refusée')
      return
    }
    sessionStorage.setItem(KEY_TOKEN, t)
    sessionStorage.setItem(KEY_ROLE,  r)
    // Signaler aux autres onglets via localStorage
    localStorage.setItem(KEY_SESSION_ID, sessionId)
    setToken(t); setRole(r)
  }, [sessionId])

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY_TOKEN)
    sessionStorage.removeItem(KEY_ROLE)
    localStorage.removeItem(KEY_SESSION_ID)
    setToken(null); setRole(null)
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
    <EtudiantAuthCtx.Provider value={{
      token, role,
      login, logout,
      isAuth: !!token && role === 'etudiant',
    }}>
      {children}
    </EtudiantAuthCtx.Provider>
  )
}

export const useEtudiantAuth = () => useContext(EtudiantAuthCtx)
