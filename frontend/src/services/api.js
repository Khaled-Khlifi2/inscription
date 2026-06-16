import axios from 'axios'

const http = axios.create({ baseURL: '/api/v1' })

http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

http.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    window.location.href = '/login/etudiant'
  }
  return Promise.reject(err)
})

/* ── Auth ── */
export const loginEtudiant     = (mat_cin, email)        => http.post('/auth/etudiant/login', { mat_cin, email })
export const loginEtudiantOtp  = (mat_cin, email, code)  => http.post('/auth/etudiant/verify-otp', { mat_cin, email, code })
export const loginScolarite    = (email, password)       => http.post('/auth/scolarite/login', { email, password })
export const loginResponsable  = (email, password)       => http.post('/auth/responsable/login', { email, password })

/* ── Étudiant — dossier ── */
export const getMyProfile      = ()     => http.get('/etudiant/me')
export const updateMyProfile   = (d)    => http.patch('/etudiant/me', d)

/* ── Étudiant — changement email ── */
export const requestEmailChange  = (nouvel_email)          => http.post('/etudiant/me/email/request-change', { nouvel_email })
export const confirmEmailChange  = (nouvel_email, code)    => http.post('/etudiant/me/email/confirm-change', { nouvel_email, code })

/* ── Étudiant — inscription ── */
export const submitInscription = (d)    => http.post('/etudiant/me/inscription', d)
export const uploadPieceJointe = (insc_id, file) => {
  const fd = new FormData(); fd.append('file', file)
  return http.post(`/etudiant/me/inscriptions/${insc_id}/pieces-jointes`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const deletePieceJointe  = (pj_id) => http.delete(`/etudiant/me/pieces-jointes/${pj_id}`)
export const downloadPieceJointe= (pj_id) => http.get(`/etudiant/me/pieces-jointes/${pj_id}/download`, { responseType: 'blob' })

/* ── Scolarité ── */
export const listEtudiants      = (p)     => http.get('/scolarite/etudiants', { params: p })
export const getEtudiant        = (id)    => http.get(`/scolarite/etudiants/${id}`)
export const createEtudiant     = (d)     => http.post('/scolarite/etudiants', d)
export const updateEtudiant     = (id,d)  => http.patch(`/scolarite/etudiants/${id}`, d)
export const deactivateEtudiant = (id)    => http.delete(`/scolarite/etudiants/${id}`)
export const resetInscription   = (id)    => http.post(`/scolarite/etudiants/${id}/reset-inscription`)
export const listNiveaux        = ()      => http.get('/scolarite/niveaux')
export const listResponsables   = ()      => http.get('/scolarite/responsables')
export const createResponsable  = (d)     => http.post('/scolarite/responsables', d)
export const importXlsx = (file, update_existing = true) => {
  const fd = new FormData(); fd.append('file', file)
  return http.post(`/scolarite/import/xlsx?update_existing=${update_existing}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const exportXlsx = async (params = {}) => {
  const res = await http.get('/scolarite/export/xlsx', { params, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url
  a.download = `etudiants_salima_${Date.now()}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}

/* ── Responsable ── */
export const getResponsableStats  = ()     => http.get('/responsable/stats')
export const listMesEtudiants     = (p)    => http.get('/responsable/etudiants', { params: p })
export const getMonEtudiant       = (id)   => http.get(`/responsable/etudiants/${id}`)
export const decideInscription    = (id,d) => http.post(`/responsable/inscriptions/${id}/decision`, d)
export const downloadPJResponsable = async (pj_id, nom) => {
  const res = await http.get(`/responsable/pieces-jointes/${pj_id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url; a.download = nom; a.click()
  URL.revokeObjectURL(url)
}

export default http
