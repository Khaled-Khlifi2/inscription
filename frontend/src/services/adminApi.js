/**
 * Client HTTP pour le portail ADMIN (scolarité + responsable)
 * Lit uniquement le token 'admin_token' depuis sessionStorage
 * Redirige vers /admin/login en cas de 401
 */
import axios from 'axios'

const adminHttp = axios.create({ baseURL: '/api/v1' })

adminHttp.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('admin_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

adminHttp.interceptors.response.use(r => r, err => {
  const url = err.config?.url || ''
  const isAuthCall = url.startsWith('/auth/')
  if (err.response?.status === 401 && !isAuthCall) {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_role')
    sessionStorage.removeItem('admin_niveau_id')
    window.location.href = '/admin/login'
  }
  return Promise.reject(err)
})

/* ── Auth ── */
export const loginScolarite   = (email, password) => adminHttp.post('/auth/scolarite/login',   { email, password })
export const loginResponsable = (email, password) => adminHttp.post('/auth/responsable/login', { email, password })

/* ── Scolarité — étudiants ── */
export const listEtudiants      = (p)     => adminHttp.get('/scolarite/etudiants', { params: p })
export const statsEtudiants     = (p)     => adminHttp.get('/scolarite/etudiants/stats', { params: p })
export const getEtudiant        = (id)    => adminHttp.get(`/scolarite/etudiants/${id}`)
export const createEtudiant     = (d)     => adminHttp.post('/scolarite/etudiants', d)
export const updateEtudiant     = (id, d) => adminHttp.patch(`/scolarite/etudiants/${id}`, d)
export const deactivateEtudiant = (id)    => adminHttp.delete(`/scolarite/etudiants/${id}`)
export const resetInscription   = (id)    => adminHttp.post(`/scolarite/etudiants/${id}/reset-inscription`)
export const decideInscriptionScolarite = (inscId, d) => adminHttp.post(`/scolarite/inscriptions/${inscId}/decision`, d)

/* ── Scolarité — niveaux & responsables ── */
export const listNiveaux       = ()         => adminHttp.get('/scolarite/niveaux')
export const createNiveau      = (d)        => adminHttp.post('/scolarite/niveaux', d)
export const updateNiveau      = (id, d)    => adminHttp.patch(`/scolarite/niveaux/${id}`, d)
export const listResponsables      = ()      => adminHttp.get('/scolarite/responsables')
export const createResponsable    = (d)      => adminHttp.post('/scolarite/responsables', d)
export const updateResponsable    = (id, d)  => adminHttp.patch(`/scolarite/responsables/${id}`, d)
export const deactivateResponsable= (id)     => adminHttp.delete(`/scolarite/responsables/${id}`)
export const reactivateResponsable= (id)     => adminHttp.post(`/scolarite/responsables/${id}/reactivate`)

/* ── Scolarité — import / export ── */
export const importXlsx = (file, update_existing = true, niveau_id = null) => {
  const fd = new FormData(); fd.append('file', file)
  const params = new URLSearchParams({ update_existing })
  if (niveau_id) params.append('niveau_id', niveau_id)
  return adminHttp.post(`/scolarite/import/xlsx?${params.toString()}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/* ── Import flexible avec mapping ── */
export const getImportFields = () =>
  adminHttp.get('/scolarite/import/fields').then(r => r.data)

export const previewImport = (file) => {
  const fd = new FormData(); fd.append('file', file)
  return adminHttp.post('/scolarite/import/preview', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const executeImport = ({ file, mapping, niveau_id, update_existing = true }) => {
  const fd = new FormData(); fd.append('file', file)
  const params = new URLSearchParams({
    mapping: JSON.stringify(mapping),
    niveau_id: String(niveau_id),
    update_existing: String(update_existing),
  })
  return adminHttp.post(`/scolarite/import/execute?${params.toString()}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}
export const exportXlsx = async (params = {}) => {
  const res = await adminHttp.get('/scolarite/export/xlsx', { params, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url
  a.download = `etudiants_salima_${Date.now()}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}

/* ── Export flexible : catalogue + custom ── */
export const getExportFields = () => adminHttp.get('/scolarite/export/fields').then(r => r.data)

export const exportCustom = async (payload) => {
  const res = await adminHttp.post('/scolarite/export/custom', payload, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url
  const ext = (payload.format || 'xlsx').toLowerCase()
  a.download = `${payload.filename || 'etudiants'}.${ext}`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── Responsable ── */
export const getResponsableStats  = ()      => adminHttp.get('/responsable/stats')
export const listMesEtudiants     = (p)     => adminHttp.get('/responsable/etudiants', { params: p })
export const getMonEtudiant       = (id)    => adminHttp.get(`/responsable/etudiants/${id}`)
export const createMonEtudiant    = (d)     => adminHttp.post('/responsable/etudiants', d)
export const updateMonEtudiant    = (id, d) => adminHttp.patch(`/responsable/etudiants/${id}`, d)
export const decideInscription    = (id, d) => adminHttp.post(`/responsable/inscriptions/${id}/decision`, d)
export const downloadPJResponsable = async (pj_id, nom) => {
  const res = await adminHttp.get(`/responsable/pieces-jointes/${pj_id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url; a.download = nom; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
/** Récupère la PJ comme URL Blob (pour <img src=...>, ne télécharge PAS) */
export const viewPJResponsable = async (pj_id) => {
  const res = await adminHttp.get(`/responsable/pieces-jointes/${pj_id}/download`, { responseType: 'blob' })
  return URL.createObjectURL(res.data)
}

export const downloadPJScolarite = async (pj_id, nom) => {
  const res = await adminHttp.get(`/scolarite/pieces-jointes/${pj_id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url; a.download = nom; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const viewPJScolarite = async (pj_id) => {
  const res = await adminHttp.get(`/scolarite/pieces-jointes/${pj_id}/download`, { responseType: 'blob' })
  return URL.createObjectURL(res.data)
}
export const importXlsxResponsable = (file, update_existing = true) => {
  const fd = new FormData(); fd.append('file', file)
  return adminHttp.post(`/responsable/import/xlsx?update_existing=${update_existing}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const exportXlsxResponsable = async (inscription_only = true) => {
  const res = await adminHttp.get('/responsable/export/xlsx', {
    params: { inscription_only }, responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url
  a.download = `etudiants_mon_niveau_${Date.now()}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}

/* ── Responsable — Profil ── */
export const getResponsableProfile = () =>
  adminHttp.get('/responsable/me').then(r => r.data)

/* ── Responsable — Import flexible (niveau forcé côté backend) ── */
export const getImportFieldsResp = () =>
  adminHttp.get('/responsable/import/fields').then(r => r.data)

export const previewImportResp = (file) => {
  const fd = new FormData(); fd.append('file', file)
  return adminHttp.post('/responsable/import/preview', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const executeImportResp = ({ file, mapping, update_existing = true }) => {
  const fd = new FormData(); fd.append('file', file)
  const params = new URLSearchParams({
    mapping: JSON.stringify(mapping),
    update_existing: String(update_existing),
  })
  return adminHttp.post(`/responsable/import/execute?${params.toString()}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

/* ── Responsable — Export flexible (niveau forcé côté backend) ── */
export const getExportFieldsResp = () =>
  adminHttp.get('/responsable/export/fields').then(r => r.data)

export const exportCustomResp = async (payload) => {
  const res = await adminHttp.post('/responsable/export/custom', payload, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url
  const ext = (payload.format || 'xlsx').toLowerCase()
  a.download = `${payload.filename || 'etudiants'}.${ext}`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default adminHttp
