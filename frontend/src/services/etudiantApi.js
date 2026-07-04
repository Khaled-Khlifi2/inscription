/**
 * Client HTTP pour le portail ÉTUDIANT
 * Lit uniquement le token 'etudiant_token' depuis sessionStorage
 * Redirige vers /etudiant/login en cas de 401
 */
import axios from 'axios'

const etudiantHttp = axios.create({ baseURL: '/api/v1' })

etudiantHttp.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('etudiant_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

etudiantHttp.interceptors.response.use(r => r, err => {
  const url = err.config?.url || ''
  // Ne PAS rediriger si l'appel est un endpoint d'authentification (login/OTP).
  // Un 401 y signifie « identifiants saisis incorrects », pas « session expirée ».
  // Le rechargement effacerait les données tapées par l'étudiant.
  const isAuthCall = url.startsWith('/auth/')
  if (err.response?.status === 401 && !isAuthCall) {
    sessionStorage.removeItem('etudiant_token')
    sessionStorage.removeItem('etudiant_role')
    window.location.href = '/etudiant/login'
  }
  return Promise.reject(err)
})

/* ── Auth étudiant ── */
export const loginEtudiant    = (identifier, email, nom_fr='', prenom_fr='') => etudiantHttp.post('/auth/etudiant/login', { identifier, email, nom_fr, prenom_fr })
export const loginEtudiantOtp = (identifier, email, code)  => etudiantHttp.post('/auth/etudiant/verify-otp', { identifier, email, code })

/* ── Dossier ── */
export const getMyProfile    = ()  => etudiantHttp.get('/etudiant/me')
export const updateMyProfile = (d) => etudiantHttp.patch('/etudiant/me', d)

/* ── Email ── */
export const requestEmailChange = (nouvel_email)       => etudiantHttp.post('/etudiant/me/email/request-change', { nouvel_email })
export const confirmEmailChange = (nouvel_email, code) => etudiantHttp.post('/etudiant/me/email/confirm-change', { nouvel_email, code })

/* ── Inscription ── */
export const prepareInscription = ()     => etudiantHttp.post('/etudiant/me/inscription/preparer')
export const submitInscription  = (d)    => etudiantHttp.post('/etudiant/me/inscription', d)
export const getInscriptionReceipt = ()  => etudiantHttp.get('/etudiant/me/inscription/recu', { responseType: 'blob' })
export const uploadPieceJointe  = (inscription_id, file, type_document = 'autre') => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type_document', type_document)
  return etudiantHttp.post(`/etudiant/me/inscriptions/${inscription_id}/pieces-jointes`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const deletePieceJointe  = (pj_id) => etudiantHttp.delete(`/etudiant/me/pieces-jointes/${pj_id}`)
export const downloadPieceJointe = (pj_id) => etudiantHttp.get(
  `/etudiant/me/pieces-jointes/${pj_id}/download`, { responseType: 'blob' }
)

export default etudiantHttp
