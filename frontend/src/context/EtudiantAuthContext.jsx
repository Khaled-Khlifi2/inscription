/**
 * Context d'authentification ÉTUDIANT
 * Cloisonné : stocke dans sessionStorage avec clé 'etudiant_*'
 * N'a AUCUN accès aux tokens admin/scolarité/responsable
 */
import { createContext, useContext, useState, useCallback } from 'react'

const EtudiantAuthCtx = createContext(null)

const KEY_TOKEN = 'etudiant_token'
const KEY_ROLE  = 'etudiant_role'    // toujours 'etudiant'

export function EtudiantAuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(KEY_TOKEN))
  const [role,  setRole]  = useState(() => sessionStorage.getItem(KEY_ROLE))

  const login = useCallback((t, r) => {
    // Sécurité : refuser si le rôle n'est pas étudiant
    if (r !== 'etudiant') {
      console.warn('[EtudiantAuth] Tentative de connexion avec rôle non-étudiant refusée')
      return
    }
    sessionStorage.setItem(KEY_TOKEN, t)
    sessionStorage.setItem(KEY_ROLE,  r)
    setToken(t); setRole(r)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY_TOKEN)
    sessionStorage.removeItem(KEY_ROLE)
    setToken(null); setRole(null)
  }, [])

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
