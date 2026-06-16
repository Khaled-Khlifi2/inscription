/**
 * App.jsx — Routage principal avec deux espaces cloisonnés
 *
 * /etudiant/*  → Portail Étudiant
 *   - /etudiant/login        → page de connexion étudiant
 *   - /etudiant/dossier      → dossier personnel
 *   - /etudiant/inscription  → formulaire d'inscription
 *   - Guards : EtudiantAuthContext (sessionStorage 'etudiant_*')
 *
 * /admin/*     → Portail Administration
 *   - /admin/login           → connexion scolarité + responsable
 *   - /admin/dashboard       → tableau de bord scolarité
 *   - /admin/etudiants       → liste étudiants
 *   - /admin/import          → import Excel
 *   - /admin/export          → export SALIMA
 *   - /admin/responsable     → kanban responsable
 *   - Guards : AdminAuthContext (sessionStorage 'admin_*')
 *
 * Les deux espaces n'ont AUCUN token en commun.
 * Un étudiant ne peut jamais accéder à /admin/* et inversement.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { EtudiantAuthProvider, useEtudiantAuth } from './context/EtudiantAuthContext'
import { AdminAuthProvider,    useAdminAuth    } from './context/AdminAuthContext'

import EtudiantLayout from './components/layout/EtudiantLayout'
import AdminLayout    from './components/layout/AdminLayout'

/* ── Pages étudiant ── */
import EtudiantLogin    from './pages/etudiant/Login'
import EtudiantProfile  from './pages/etudiant/Profile'
import Inscription      from './pages/etudiant/Inscription'

/* ── Pages admin ── */
import AdminLogin           from './pages/admin/Login'
import ScolariteDashboard   from './pages/scolarite/Dashboard'
import EtudiantsList        from './pages/scolarite/EtudiantsList'
import ImportPage           from './pages/scolarite/ImportPage'
import ExportPage           from './pages/scolarite/ExportPage'
import ResponsableDashboard from './pages/responsable/Dashboard'
import ResponsablesPage     from './pages/scolarite/ResponsablesPage'

/* ══════════════════════════════════════
   GUARDS ÉTUDIANT
══════════════════════════════════════ */
function EtudiantPublicOnly({ children }) {
  const { isAuth } = useEtudiantAuth()
  return isAuth ? <Navigate to="/etudiant/inscription" replace /> : children
}

function RequireEtudiant() {
  const { isAuth } = useEtudiantAuth()
  return isAuth ? <EtudiantLayout /> : <Navigate to="/etudiant/login" replace />
}

/* ══════════════════════════════════════
   GUARDS ADMIN
══════════════════════════════════════ */
function AdminPublicOnly({ children }) {
  const { isAuth, isScolarite } = useAdminAuth()
  if (!isAuth) return children
  return <Navigate to={isScolarite ? '/admin/dashboard' : '/admin/responsable'} replace />
}

function RequireScolarite() {
  const { isAuth, isScolarite } = useAdminAuth()
  if (!isAuth)        return <Navigate to="/admin/login" replace />
  if (!isScolarite)   return <Navigate to="/admin/login" replace />
  return <AdminLayout />
}

function RequireResponsable() {
  const { isAuth, isResponsable } = useAdminAuth()
  if (!isAuth)         return <Navigate to="/admin/login" replace />
  if (!isResponsable)  return <Navigate to="/admin/login" replace />
  return <AdminLayout />
}

/* ══════════════════════════════════════
   ROUTEUR ÉTUDIANT (context isolé)
══════════════════════════════════════ */
function EtudiantRouter() {
  return (
    <EtudiantAuthProvider>
      <Routes>
        <Route path="login" element={<EtudiantPublicOnly><EtudiantLogin /></EtudiantPublicOnly>} />
        <Route element={<RequireEtudiant />}>
          <Route path="dossier"      element={<EtudiantProfile />} />
          <Route path="inscription"  element={<Inscription />} />
          <Route index               element={<Navigate to="inscription" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="login" replace />} />
      </Routes>
    </EtudiantAuthProvider>
  )
}

/* ══════════════════════════════════════
   ROUTEUR ADMIN (context isolé)
══════════════════════════════════════ */
function AdminRouter() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminPublicOnly><AdminLogin /></AdminPublicOnly>} />

        {/* Scolarité */}
        <Route element={<RequireScolarite />}>
          <Route path="dashboard"  element={<ScolariteDashboard />} />
          <Route path="etudiants"  element={<EtudiantsList />} />
          <Route path="import"     element={<ImportPage />} />
          <Route path="export"     element={<ExportPage />} />
          <Route path="responsables" element={<ResponsablesPage />} />
        </Route>

        {/* Responsable */}
        <Route element={<RequireResponsable />}>
          <Route path="responsable"        element={<ResponsableDashboard />} />
          <Route path="responsable/import" element={<ImportPage mode="responsable" />} />
          <Route path="responsable/export" element={<ExportPage mode="responsable" />} />
        </Route>

        <Route index  element={<Navigate to="login" replace />} />
        <Route path="*" element={<Navigate to="login" replace />} />
      </Routes>
    </AdminAuthProvider>
  )
}

/* ══════════════════════════════════════
   APP PRINCIPALE
══════════════════════════════════════ */
export default function App() {
  return (
    <Routes>
      {/* Portail étudiant — /etudiant/* */}
      <Route path="/etudiant/*" element={<EtudiantRouter />} />

      {/* Portail admin — /admin/* */}
      <Route path="/admin/*" element={<AdminRouter />} />

      {/* Racine → portail étudiant (accès direct, la partie admin est séparée et non exposée) */}
      <Route path="/" element={<Navigate to="/etudiant/login" replace />} />

      {/* Toute autre URL → accueil */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}


