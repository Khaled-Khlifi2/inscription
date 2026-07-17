import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  getMyProfile, updateMyProfile, submitInscription,
  prepareInscription, uploadPieceJointe, deletePieceJointe,
  requestEmailChange, confirmEmailChange, getInscriptionReceipt,
  getPiecesJointesConfig,
} from '../../services/etudiantApi'
import { Btn, PageLoader, Badge } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  Mail, Phone, PhoneCall, MapPin, Send, Save,
  Lock, Upload, Trash2, FileText, CheckCircle, AlertCircle,
  Clock, XCircle, RefreshCw, Info, AlertTriangle,
  Edit3, ShieldCheck, User, Globe, Image as ImageIcon,
  IdCard, FileUp, Camera, Eye, Download,
} from 'lucide-react'
import clsx from 'clsx'

const API_BASE = '/api/v1'
const REGLEMENT_INTERNE_HREF = '/etudiant/reglement'
const tokenHeader = () => ({
  Authorization: `Bearer ${sessionStorage.getItem('etudiant_token') || ''}`,
})
const FALLBACK_PIECES_CONFIG = {
  default_case: 'nouveau_etudiant',
  cases: {
    nouveau_etudiant: {
      label: 'Nouveaux etudiants',
      pieces: [
        { type: 'photo', label: 'Photo de profil', description: 'Visage clair, fond neutre', required: true, slot: 'single', format: 'image', max_mb: 5 },
        { type: 'cin', label: "Carte d'identite (CIN) - face 1", description: 'Image lisible de la premiere face', required: true, slot: 'single', format: 'image', max_mb: 5 },
        { type: 'cin_verso', label: "Carte d'identite (CIN) - face 2", description: 'Image lisible de la deuxieme face', required: true, slot: 'single', format: 'image', max_mb: 5 },
        { type: 'recu_paiement', label: 'Recu de paiement', description: "Justificatif de paiement des frais d'inscription", required: true, slot: 'single', format: 'pdf', max_mb: 10 },
        { type: 'releve_bac', label: 'Releve de notes du BAC', description: 'Releve officiel des notes du baccalaureat', required: true, slot: 'single', format: 'pdf', max_mb: 10 },
      ],
    },
  },
}
const normalizePieceType = type => String(type || '').trim().toLowerCase()

// ══════════════════════════════════════════════════════════════
//   COMPOSANTS UI RÉUTILISABLES
// ══════════════════════════════════════════════════════════════

// ── Statut badge ─────────────────────────────────────────────
function StatutBadge({ insc }) {
  if (!insc)                          return <Badge color="gray">Non soumise</Badge>
  if (insc.statut === 'brouillon')    return <Badge color="gray">📝 Brouillon — non soumise</Badge>
  if (insc.statut === 'validee')      return <Badge color="green">✓ Inscrit</Badge>
  if (insc.statut === 'soumis')       return <Badge color="amber">⏳ Soumise — en attente</Badge>
  if (insc.statut === 'en_attente')   return <Badge color="amber">⏳ Re-soumise — en attente</Badge>
  if (insc.statut === 'rejetee')      return <Badge color="red">✗ Refusée</Badge>
  return null
}

// ── Champ verrouillé ─────────────────────────────────────────
function LockedField({ label, value, arabic = false, fullWidth = false }) {
  return (
    <div className={clsx('flex flex-col gap-1', fullWidth && 'sm:col-span-2 lg:col-span-3 xl:col-span-4')}>
      <label className="text-[0.7rem] font-semibold text-mist uppercase tracking-wider flex items-center gap-1">
        <Lock size={9} className="text-fog" /> {label}
      </label>
      <div className="bg-ghost/70 border border-fog/30 rounded-xl px-3.5 py-2.5 text-ink-muted text-sm select-none break-words"
        dir={arabic ? 'rtl' : 'ltr'}>
        {value || <span className="text-fog italic text-xs">Non renseigné</span>}
      </div>
    </div>
  )
}

// ── Champ modifiable ─────────────────────────────────────────
function EditField({ label, value, onChange, placeholder, icon, error, disabled, arabic = false, required = false, fullWidth = false }) {
  return (
    <div className={clsx('flex flex-col gap-1', fullWidth && 'sm:col-span-2 lg:col-span-3 xl:col-span-4')}>
      <label className="text-[0.7rem] font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
        {label} {required && <span className="text-brand">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none">{icon}</span>
        )}
        <input
          className={clsx(
            'w-full border-[1.5px] rounded-xl py-2.5 text-sm outline-none transition-all',
            icon ? 'pl-10 pr-3.5' : 'px-3.5',
            disabled
              ? 'bg-ghost border-fog/30 text-ink-muted cursor-not-allowed'
              : error
                ? 'bg-white border-danger focus:ring-2 focus:ring-danger/15 text-ink'
                : 'bg-white border-fog hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/10 text-ink'
          )}
          value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
          dir={arabic ? 'rtl' : 'ltr'}
        />
      </div>
      {error && <p className="text-xs text-danger flex items-center gap-1"><AlertTriangle size={11}/>{error}</p>}
    </div>
  )
}

// ── Section pleine largeur (style fiche technique) ───────────
function Section({ icon, title, subtitle, children, accent = 'gray', action }) {
  const headerBg = {
    blue:    'bg-blue-50 border-blue-200',
    gray:    'bg-gray-50 border-gray-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber:   'bg-amber-50 border-amber-200',
    red:     'bg-red-50 border-red-200',
    brand:   'bg-brand/5 border-brand/15',
  }[accent] || 'bg-gray-50 border-gray-200'
  const iconColor = {
    blue:    'text-blue-700 bg-blue-100',
    gray:    'text-gray-600 bg-gray-200',
    emerald: 'text-emerald-700 bg-emerald-100',
    amber:   'text-amber-700 bg-amber-100',
    red:     'text-red-700 bg-red-100',
    brand:   'text-brand bg-brand/15',
  }[accent] || 'text-gray-600 bg-gray-200'
  return (
    <section className="bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden">
      <header className={clsx('flex items-center gap-3 px-5 py-3 border-b', headerBg)}>
        {icon && (
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}>{icon}</div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-mist mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

// ── Section email avec OTP ───────────────────────────────────
function EmailSection({ currentEmail, onEmailChanged, disabled }) {
  const [open, setOpen]         = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [otpSent, setOtpSent]   = useState(false)
  const [code, setCode]         = useState('')
  const [ldSend, setLdSend]     = useState(false)
  const [ldVerify, setLdVerify] = useState(false)

  const reset = () => { setOpen(false); setOtpSent(false); setNewEmail(''); setCode('') }

  const handleSend = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) { toast.error('Email invalide'); return }
    setLdSend(true)
    try {
      await requestEmailChange(newEmail.trim())
      setOtpSent(true)
      toast.success(`Code envoyé à ${newEmail.trim()}`)
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur envoi OTP') }
    finally { setLdSend(false) }
  }

  const handleVerify = async () => {
    if (!code.trim()) { toast.error('Entrez le code reçu par email'); return }
    setLdVerify(true)
    try {
      await confirmEmailChange(newEmail.trim(), code.trim())
      toast.success('Email mis à jour !')
      onEmailChanged(newEmail.trim()); reset()
    } catch (e) { toast.error(e.response?.data?.detail || 'Code invalide ou expiré') }
    finally { setLdVerify(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 p-4 bg-success-soft/40 border border-success/20 rounded-xl">
        <div className="w-9 h-9 bg-success/10 rounded-xl flex items-center justify-center shrink-0">
          <ShieldCheck size={16} className="text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[0.7rem] font-semibold text-success uppercase tracking-wider">Email vérifié</p>
          <p className="text-sm font-medium text-ink truncate">{currentEmail}</p>
        </div>
        {!disabled && !open && (
          <Btn size="xs" variant="ghost" icon={<Edit3 size={12}/>} onClick={() => setOpen(true)}>
            Changer
          </Btn>
        )}
      </div>

      {open && !disabled && (
        <div className="border border-brand/20 bg-brand-soft/20 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-mist">Un code OTP sera envoyé au <strong>nouvel email</strong> pour vérification.</p>
          {!otpSent ? (
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <input className="w-full bg-white border-[1.5px] border-fog rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                  placeholder="nouveau@email.com" type="email" value={newEmail}
                  onChange={e => setNewEmail(e.target.value)} autoFocus />
              </div>
              <Btn loading={ldSend} icon={<Send size={13}/>} onClick={handleSend}>Envoyer</Btn>
              <Btn variant="ghost" onClick={reset}>Annuler</Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-mist">Code envoyé à <strong className="text-ink">{newEmail}</strong></p>
              <div className="flex gap-2 flex-wrap">
                <input className="flex-1 min-w-[150px] bg-white border-[1.5px] border-fog rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 font-mono tracking-widest"
                  placeholder="000000" value={code} maxLength={6} inputMode="numeric"
                  onChange={e => setCode(e.target.value)} autoFocus />
                <Btn loading={ldVerify} variant="success" icon={<CheckCircle size={13}/>} onClick={handleVerify}>Confirmer</Btn>
              </div>
              <div className="flex gap-3 text-xs flex-wrap">
                <button onClick={() => setOtpSent(false)} className="text-mist hover:text-ink">← Changer l'email</button>
                <button onClick={handleSend} disabled={ldSend} className="text-brand hover:underline disabled:opacity-40">Renvoyer</button>
                <button onClick={reset} className="text-mist hover:text-danger ml-auto">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Slot d'upload pour image typée ───────────────────────────
function ImageUploadSlot({
  type,
  title,
  description,
  icon,
  accent,
  piece,            // PJ existante OU null
  onUpload,
  onDelete,
  onView,
  disabled,
  uploading,
  showOcrStatus = false,
}) {
  const inputRef = useRef()

  return (
    <div className={clsx(
      'rounded-2xl border-2 overflow-hidden transition-all',
      piece
        ? piece.ocr_verified ? 'border-emerald-300 bg-emerald-50/30' : 'border-amber-300 bg-amber-50/30'
        : 'border-dashed border-fog hover:border-brand/40',
    )}>
      <header className={clsx(
        'flex items-center gap-3 px-4 py-3 border-b',
        accent === 'brand' ? 'bg-brand/5 border-brand/15' : 'bg-blue-50 border-blue-200'
      )}>
        <div className={clsx(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          accent === 'brand' ? 'text-brand bg-brand/15' : 'text-blue-700 bg-blue-100'
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink uppercase tracking-wide leading-tight">{title}</p>
          <p className="text-xs text-mist mt-0.5">{description}</p>
        </div>
        {piece && (
          <Badge color={piece.statut === 'refusee' ? 'red' : piece.ocr_verified ? 'green' : showOcrStatus ? 'amber' : 'blue'}>
            {piece.ocr_verified ? '✓ Vérifié' : showOcrStatus ? 'À revoir' : 'Téléversé'}
          </Badge>
        )}
      </header>

      <div className="p-4">
        {!piece ? (
          <>
            <input
              ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={e => e.target.files[0] && onUpload(e.target.files[0])}
              disabled={uploading || disabled}
            />
            <button
              type="button" onClick={() => inputRef.current?.click()}
              disabled={uploading || disabled}
              className={clsx(
                'w-full flex flex-col items-center justify-center gap-2 py-7 px-4 rounded-xl text-center transition-all',
                'border-2 border-dashed',
                uploading
                  ? 'border-brand bg-brand/5'
                  : disabled
                    ? 'border-fog/40 bg-ghost/30 cursor-not-allowed opacity-60'
                    : 'border-fog hover:border-brand/50 hover:bg-brand/5 cursor-pointer'
              )}>
              <Camera size={28} className={clsx('transition-colors', uploading ? 'text-brand animate-bounce' : 'text-fog')} />
              <p className={clsx('text-sm font-semibold', uploading ? 'text-brand' : 'text-mist')}>
                {uploading ? 'Envoi en cours…' : 'Cliquez pour téléverser une image'}
              </p>
              <p className="text-xs text-fog">JPG, PNG ou WEBP — max 5 MB</p>
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-fog/40">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ImageIcon size={20} className="text-blue-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{piece.nom_fichier}</p>
                <p className="text-xs text-mist mt-0.5">
                  {(piece.taille_octets / 1024).toFixed(0)} KB
                  {piece.uploaded_at && ` · ${new Date(piece.uploaded_at).toLocaleDateString('fr-FR')}`}
                </p>
                {piece.statut === 'refusee' && piece.motif_refus && (
                  <p className="mt-1 text-xs text-red-700 leading-relaxed">
                    Motif du refus : {piece.motif_refus}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={onView}
                  className="p-2 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white transition-all"
                  title="Voir l'image">
                  <Eye size={14}/>
                </button>
                {!disabled && (
                  <button type="button" onClick={onDelete}
                    className="p-2 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white transition-all"
                    title="Supprimer">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════
export default function Inscription() {
  const [data, setData]       = useState(null)
  const [piecesConfig, setPiecesConfig] = useState(FALLBACK_PIECES_CONFIG)
  const [originalNames, setOriginalNames] = useState({
    nom_fr: '', prenom_fr: '', nom_ar: '', prenom_ar: '', date_naissance: '',
  })
  const [form, setForm]       = useState({
    nom_fr: '', prenom_fr: '', nom_ar: '', prenom_ar: '',
    date_naissance: '', lieu_naiss_fr: '', lieu_naiss_ar: '',
    sexe: '', situation_familiale: '',
    code_gouvernorat: '', code_type_bac: '', num_cnss: '',
    // Baccalauréat details
    bac_annee: '', bac_session: '', bac_moyenne: '', bac_mention: '', bac_section: '',
    telephone_portable: '', telephone_fixe: '', adresse_fr: '', adresse_ar: '',
    // Contact en cas de besoin
    contact_nom: '', contact_prenom: '', contact_affiliation: '',
    contact_adresse: '', contact_tel: '',
  })
  const [saving, setSave]     = useState(false)
  const [submitting, setSub]  = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [uploadingType, setUploadingType] = useState(null)   // null | 'photo' | 'cin' | 'autre'
  const [errors, setErrors]   = useState({})
  const [reglementAccepted, setReglementAccepted] = useState(false)
  const [activeSection, setActiveSection] = useState('admin')

  const activeInsc  = data?.inscriptions?.find(i => i.annee_universitaire === '2025/2026') || null
  const isBrouillon = activeInsc?.statut === 'brouillon'
  const isValidee   = activeInsc?.statut === 'validee'
  const isRejete    = activeInsc?.statut === 'rejetee'
  const isSoumis    = activeInsc?.statut === 'soumis'
  const isEnAttente = activeInsc?.statut === 'en_attente'
  // Le brouillon et le rejet restent éditables (l'étudiant peut corriger/resoumettre).
  // 'soumis', 'en_attente' (re-soumission) et 'validee' bloquent l'édition.
  const canEdit     = !isValidee && !isSoumis && !isEnAttente
  // "Vraiment soumise" : tout sauf brouillon (qui est l'état initial avant clic sur Soumettre)
  const isSubmitted = !!activeInsc && !isBrouillon

  // Si `keepForm` est true, on ne réinitialise PAS le state `form` depuis la DB.
  // Indispensable après les uploads/suppressions de PJ pour ne pas écraser les
  // modifications en cours de saisie de l'étudiant.
  //
  // Le formulaire est initialisé par fusion : proposed_data || données Etudiant.
  // Les `proposed_data` représentent les modifications proposées par l'étudiant
  // mais pas encore validées par le responsable — elles doivent rester visibles
  // dans le formulaire pour permettre la correction et la re-soumission.
  const reload = async ({ keepForm = false } = {}) => {
    const r = await getMyProfile()
    setData(r.data)
    const insc = r.data.inscriptions?.find(i => i.annee_universitaire === '2025/2026')
    // Référence SALIMA (Etudiant officiel) pour le badge "MODIFIÉ" côté étudiant
    setOriginalNames({
      nom_fr:         r.data.nom_fr         || '',
      prenom_fr:      r.data.prenom_fr      || '',
      nom_ar:         r.data.nom_ar         || '',
      prenom_ar:      r.data.prenom_ar      || '',
      date_naissance: r.data.date_naissance || '',
    })
    if (keepForm) return
    const pd = insc?.proposed_data || {}
    const pick = (k) => (pd[k] !== undefined && pd[k] !== null ? pd[k] : (r.data[k] || ''))
    setForm({
      nom_fr:              pick('nom_fr'),
      prenom_fr:           pick('prenom_fr'),
      nom_ar:              pick('nom_ar'),
      prenom_ar:           pick('prenom_ar'),
      date_naissance:      pick('date_naissance'),
      lieu_naiss_fr:       pick('lieu_naiss_fr'),
      lieu_naiss_ar:       pick('lieu_naiss_ar'),
      sexe:                pick('sexe'),
      situation_familiale: pick('situation_familiale'),
      code_gouvernorat:    pick('code_gouvernorat'),
      code_type_bac:       pick('code_type_bac'),
      // Baccalauréat details
      bac_annee:           pick('bac_annee'),
      bac_session:         pick('bac_session'),
      bac_moyenne:         pick('bac_moyenne'),
      bac_mention:         pick('bac_mention'),
      bac_section:         pick('bac_section'),
      num_cnss:            pick('num_cnss'),
      telephone_portable:  pick('telephone_portable'),
      telephone_fixe:      pick('telephone_fixe'),
      adresse_fr:          pick('adresse_fr'),
      adresse_ar:          pick('adresse_ar'),
      // Contact en cas de besoin
      contact_nom:         pick('contact_nom'),
      contact_prenom:      pick('contact_prenom'),
      contact_affiliation: pick('contact_affiliation'),
      contact_adresse:     pick('contact_adresse'),
      contact_tel:         pick('contact_tel'),
    })
  }

  useEffect(() => { reload() }, [])
  useEffect(() => {
    getPiecesJointesConfig()
      .then(r => setPiecesConfig(r.data || FALLBACK_PIECES_CONFIG))
      .catch(() => setPiecesConfig(FALLBACK_PIECES_CONFIG))
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: typeof e === 'string' ? e : e.target.value }))

  // ── Champs obligatoires pour soumettre le dossier ────────────
  // Chaque entrée : [clé du form, libellé affiché, validateur optionnel]
  // Note : Les champs d'identité (nom, prénom, date_naissance, lieu_naiss, sexe) sont verrouillés
  const REQUIRED_FIELDS = [
    ['code_gouvernorat',   'Gouvernorat'],
    ['telephone_portable', 'Téléphone portable'],
    ['adresse_fr',         'Adresse'],
    ['contact_nom',        'Nom du contact'],
    ['contact_prenom',     'Prénom du contact'],
    ['contact_tel',        'Téléphone du contact'],
  ]

  const missingFormFields = REQUIRED_FIELDS.filter(([k]) => !String(form[k] || '').trim())

  const validate = () => {
    const e = {}
    missingFormFields.forEach(([k, label]) => { e[k] = `${label} obligatoire` })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!form.nom_fr.trim() || !form.prenom_fr.trim()) {
      toast.error('Nom et prénom obligatoires'); return
    }
    setSave(true)
    try {
      await updateMyProfile(Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')))
      toast.success('Informations sauvegardées')
      await reload()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setSave(false) }
  }

  const handleSubmit = async () => {
    if (!validate()) { toast.error('Veuillez remplir tous les champs obligatoires'); return }
    if (!reglementAccepted) {
      toast.error('Vous devez lire et accepter le reglement interne avant la soumission.')
      return
    }
    if (missingRequiredPieces.length > 0) {
      toast.error('Veuillez d\'abord televerser toutes les pieces obligatoires.')
      return
    }
    if (!window.confirm('Confirmer la soumission de votre dossier d\'inscription ?')) return
    setSub(true)
    try {
      await updateMyProfile(Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')))
      await submitInscription({
        ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')),
        reglement_interne_accepte: true,
      })
      toast.success('Dossier soumis — en attente de validation ✓')
      await reload()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur lors de la soumission') }
    finally { setSub(false) }
  }

  // Upload typed (photo / cin / autre)
  const handleTypedUpload = async (file, type) => {
    if (!file || !data) return
    if (!data.email_verified) {
      toast.error('Vérifiez votre email avant de joindre des pièces'); return
    }
    setUploadingType(type)
    try {
      let insc = activeInsc
      if (!insc) {
        const prep = await prepareInscription()
        insc = prep.data?.inscriptions?.find(i => i.annee_universitaire === '2025/2026') || null
        await reload({ keepForm: true })
        if (!insc) { toast.error('Impossible de préparer l\'inscription'); return }
      }
      const res = await uploadPieceJointe(insc.id, file, type)
      const verified = res?.data?.ocr_verified
      const msg = res?.data?.ocr_message
      if (type === 'cin') {
        if (verified) toast.success(msg || 'Carte d\'identité vérifiée ✓')
        else if (msg) toast(msg, { icon: '⚠️', duration: 6000 })
        else toast.success('Carte d\'identité téléversée')
      } else {
        toast.success(`"${file.name}" joint avec succès`)
      }
      await reload({ keepForm: true })
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur upload', { duration: 6000 })
    } finally { setUploadingType(null) }
  }

  const handleDeletePJ = async (pj_id, nom) => {
    if (!window.confirm(`Supprimer "${nom}" ?`)) return
    try { await deletePieceJointe(pj_id); toast.success('Document supprimé'); await reload({ keepForm: true }) }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const handleViewPiece = pj_id => {
    // Ouvre la pièce inline (image ou PDF). Le token est ajouté manuellement
    // car c'est un nouvel onglet.
    fetch(`${API_BASE}/etudiant/me/pieces-jointes/${pj_id}/download`, { headers: tokenHeader() })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      })
      .catch(() => toast.error('Impossible d\'ouvrir le fichier'))
  }

  const handleOpenReceipt = async () => {
    setReceiptLoading(true)
    try {
      const res = await getInscriptionReceipt()
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Reçu indisponible')
    } finally {
      setReceiptLoading(false)
    }
  }

  if (!data) return <PageLoader />

  const allPieces = activeInsc?.pieces_jointes || []
  const currentPiecesCase = piecesConfig.cases?.[piecesConfig.default_case] || FALLBACK_PIECES_CONFIG.cases.nouveau_etudiant
  const configuredPieces = currentPiecesCase.pieces || []
  const imageSinglePieces = configuredPieces.filter(p => p.format === 'image' && p.slot === 'single')
  const pdfSinglePieces = configuredPieces.filter(p => p.format === 'pdf' && p.slot === 'single')
  const pieceByType = type => allPieces.find(p => normalizePieceType(p.type_document) === normalizePieceType(type)) || null
  const piecesByType = type => allPieces.filter(p => normalizePieceType(p.type_document || 'autre') === normalizePieceType(type))
  const isPieceAccepted = type => {
    const conf = configuredPieces.find(p => p.type === type)
    const pieces = conf?.slot === 'multiple' ? piecesByType(type) : [pieceByType(type)].filter(Boolean)
    return pieces.some(p => p.statut !== 'refusee')
  }
  const missingRequiredPieces = configuredPieces.filter(p => p.required && !isPieceAccepted(p.type))
  const requiredPiecesReady = missingRequiredPieces.length === 0

  const missingSubmitItems = [
    !data.email_verified && { key: 'email', label: 'Vérification de l\'adresse email' },
    ...missingFormFields.map(([key, label]) => ({ key, label })),
    ...missingRequiredPieces.map(piece => ({ key: piece.type, label: piece.label })),
    !reglementAccepted && { key: 'reglement', label: 'Acceptation du reglement interne' },
  ].filter(Boolean)
  const readyToSubmit = missingSubmitItems.length === 0
  const sections = [
    { value: 'admin', label: 'Dossier', icon: <Lock size={15}/>, done: !!(data.mat_cin && data.cfil && data.nom_fr && data.prenom_fr) },
    { value: 'personal', label: 'Infos', icon: <Info size={15}/>, done: !!form.code_gouvernorat },
    { value: 'contact', label: 'Contact', icon: <Phone size={15}/>, done: missingFormFields.length === 0 && data.email_verified },
    { value: 'documents', label: 'Pieces', icon: <FileText size={15}/>, done: requiredPiecesReady },
    { value: 'submit', label: 'Soumission', icon: <Send size={15}/>, done: readyToSubmit || (isSubmitted && !isRejete), count: missingSubmitItems.length },
  ]
  const currentSectionIndex = sections.findIndex(section => section.value === activeSection)
  const goToSection = offset => {
    const next = sections[currentSectionIndex + offset]
    if (next) setActiveSection(next.value)
  }

  return (
    <div className="w-full max-w-none px-4 py-2 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">
            Dossier d'inscription
          </h1>
          <p className="text-mist mt-1 text-sm">
            Année universitaire 2025/2026 — {data.niveau?.libelle || 'Niveau non défini'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatutBadge insc={activeInsc} />
        </div>
      </div>

      {/* ── Bannières statut ── */}
      {isValidee && (
        <div className="bg-success-soft border border-success/20 rounded-2xl p-5 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="font-bold text-teal-800 text-lg">Inscription validée</p>
            <p className="text-teal-700 text-sm mt-0.5">
              Votre inscription a été acceptée
              {activeInsc?.traite_le ? ` le ${new Date(activeInsc.traite_le).toLocaleDateString('fr-FR', { dateStyle: 'long' })}` : ''}.
            </p>
          </div>
          <Btn
            variant="success"
            icon={<Download size={15}/>}
            loading={receiptLoading}
            onClick={handleOpenReceipt}
          >
            Reçu d'inscription
          </Btn>
        </div>
      )}

      {isEnAttente && (
        <div className="bg-warn-soft border border-warn/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-warn rounded-xl flex items-center justify-center shrink-0">
            <Clock size={22} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-amber-800">Dossier en cours de traitement</p>
            <p className="text-amber-700 text-sm mt-0.5">Votre dossier est examiné par le responsable. Aucune modification possible.</p>
          </div>
        </div>
      )}

      {isRejete && (
        <div className="bg-danger-soft border border-danger/20 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-danger rounded-xl flex items-center justify-center shrink-0">
              <XCircle size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-800 text-lg">Dossier refusé — corrections requises</p>
              <p className="text-red-700 text-sm mt-1 mb-3">Corrigez les informations indiquées puis resoumettez votre dossier.</p>
              {activeInsc?.message_rejet && (
                <div className="bg-white/70 border border-danger/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle size={12}/> Message du responsable
                  </p>
                  <p className="text-sm text-red-800 leading-relaxed">{activeInsc.message_rejet}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-ghost shadow-sm p-2 grid grid-cols-2 md:grid-cols-5 gap-2">
        {sections.map(section => (
          <button
            key={section.value}
            type="button"
            onClick={() => setActiveSection(section.value)}
            className={clsx(
              'min-h-[3.25rem] px-3 py-2 rounded-xl flex items-center gap-2 text-left transition-all border',
              activeSection === section.value
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-white text-steel border-transparent hover:bg-ghost hover:text-ink'
            )}
          >
            <span className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              activeSection === section.value ? 'bg-white/20 text-white' : 'bg-ghost text-mist'
            )}>
              {section.done ? <CheckCircle size={15}/> : section.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold truncate">{section.label}</span>
              {section.count > 0 && !section.done && (
                <span className={clsx(
                  'block text-[0.68rem] font-semibold',
                  activeSection === section.value ? 'text-white/80' : 'text-amber-700'
                )}>
                  {section.count} restant{section.count > 1 ? 's' : ''}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ─── 1. Informations administratives (verrouillées — filière SALIMA) ─── */}
      {activeSection === 'admin' && (
        <>
      <Section
        icon={<Lock size={16}/>}
        title="Données administratives & filière"
        subtitle="Données SALIMA — non modifiables (contactez la scolarité en cas d'erreur)"
        accent="gray"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
          <LockedField label="Matricule CIN"     value={data.mat_cin} />
          <LockedField label="Passeport"         value={data.passeport} />
          <LockedField label="N° Inscription"    value={data.num_inscription} />
          <LockedField label="Code filière"      value={data.cfil} />
          <LockedField label="Niveau d'études"   value={data.niveau?.libelle} />
          <LockedField label="Filière"           value={data.lib_filiere} fullWidth />
          <LockedField label="الشعبة"            value={data.lib_filiere_ar} arabic fullWidth />
        </div>
      </Section>

      {/* ─── 2. Identité (verrouillée) ─── */}
      <Section
        icon={<User size={16}/>}
        title="Identité"
        subtitle="Nom, prénom et date de naissance — données verrouillées (non modifiables)"
        accent="gray"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
          <LockedField label="Nom (FR)"           value={form.nom_fr} />
          <LockedField label="Prénom (FR)"        value={form.prenom_fr} />
          <LockedField label="اللقب (AR)"          value={form.nom_ar} arabic />
          <LockedField label="الاسم (AR)"          value={form.prenom_ar} arabic />
          <LockedField label="Date de naissance"  value={form.date_naissance} />
          <LockedField label="Lieu de naissance (FR)" value={form.lieu_naiss_fr} />
          <LockedField label="مكان الولادة (AR)"     value={form.lieu_naiss_ar} arabic />
          <LockedField label="Sexe"                value={form.sexe === 'M' ? 'Masculin' : form.sexe === 'F' ? 'Féminin' : form.sexe} />
        </div>
      </Section>

      {/* ─── 2bis. État civil & informations personnelles (modifiables) ─── */}
        </>
      )}
      {activeSection === 'personal' && (
        <>
      <Section
        icon={<Info size={16}/>}
        title="État civil & informations personnelles"
        subtitle="Situation familiale, gouvernorat, BAC, CNSS — modifiables"
        accent="blue"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
          <EditField
            label="Situation familiale" placeholder="Ex : Célibataire"
            value={form.situation_familiale} onChange={set('situation_familiale')}
            disabled={!canEdit}
          />
          <EditField
            label="Code gouvernorat" placeholder="Ex : 11 (Tunis)"
            value={form.code_gouvernorat} onChange={set('code_gouvernorat')}
            disabled={!canEdit}
          />
          {/* <EditField
            label="Type BAC" placeholder="Ex : Mathématiques"
            value={form.code_type_bac} onChange={set('code_type_bac')}
            disabled={!canEdit}
          /> */}
          <EditField
            label="N° CNSS" placeholder="Ex : 12345678"
            value={form.num_cnss} onChange={set('num_cnss')}
            disabled={!canEdit}
          />
        </div>
      </Section>

      {/* ─── 2ter. Baccalauréat ─── */}
      <Section
        icon={<FileText size={16}/>}
        title="Baccalauréat"
        subtitle="Détails du diplôme — modifiables"
        accent="emerald"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
          <EditField
            label="Année du BAC" placeholder="Ex : 2024"
            value={form.bac_annee} onChange={set('bac_annee')}
            disabled={!canEdit}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[0.7rem] font-semibold text-ink uppercase tracking-wider">Session</label>
            <select
              className="w-full border-[1.5px] rounded-xl py-2.5 text-sm outline-none bg-white border-fog hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/10 text-ink px-3.5"
              value={form.bac_session} onChange={set('bac_session')}
              disabled={!canEdit}
            >
              <option value="">Sélectionner...</option>
              <option value="principale">Session principale</option>
              <option value="controle">Session de contrôle</option>
            </select>
          </div>
          <EditField
            label="Moyenne" placeholder="Ex : 15.50"
            value={form.bac_moyenne} onChange={set('bac_moyenne')}
            disabled={!canEdit}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[0.7rem] font-semibold text-ink uppercase tracking-wider">Mention</label>
            <select
              className="w-full border-[1.5px] rounded-xl py-2.5 text-sm outline-none bg-white border-fog hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/10 text-ink px-3.5"
              value={form.bac_mention} onChange={set('bac_mention')}
              disabled={!canEdit}
            >
              <option value="">Sélectionner...</option>
              <option value="Très bien">Très bien</option>
              <option value="Bien">Bien</option>
              <option value="Assez bien">Assez bien</option>
              <option value="Passable">Passable</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <label className="text-[0.7rem] font-semibold text-ink uppercase tracking-wider">Section</label>
            <select
              className="w-full border-[1.5px] rounded-xl py-2.5 text-sm outline-none bg-white border-fog hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/10 text-ink px-3.5"
              value={form.bac_section} onChange={set('bac_section')}
              disabled={!canEdit}
            >
              <option value="">Sélectionner...</option>
              <option value="Mathématiques">Mathématiques</option>
              <option value="Sciences expérimentales">Sciences expérimentales</option>
              <option value="Sciences techniques">Sciences techniques</option>
              <option value="Informatique">Informatique</option>
              <option value="Économie et gestion">Économie et gestion</option>
              <option value="Sport">Sport</option>
            </select>
          </div>
        </div>
      </Section>

      {/* ─── 3. Email ─── */}
        </>
      )}
      {activeSection === 'contact' && (
        <>
      <Section icon={<Mail size={16}/>} title="Adresse email" subtitle="Vérifiée par OTP — sert pour la connexion et les notifications" accent="emerald">
        <EmailSection currentEmail={data.email} disabled={!canEdit} onEmailChanged={async () => await reload()} />
      </Section>

      {/* ─── 4. Coordonnées ─── */}
      <Section icon={<Globe size={16}/>} title="Coordonnées" subtitle="Téléphone et adresse postale" accent="blue">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
          <EditField
            label="Téléphone portable" placeholder="22 334 455" required
            value={form.telephone_portable} onChange={set('telephone_portable')}
            icon={<Phone size={15}/>} error={errors.telephone_portable}
            disabled={!canEdit}
          />
          <EditField
            label="Téléphone portable 2" placeholder="71 234 567"
            value={form.telephone_fixe} onChange={set('telephone_fixe')}
            icon={<PhoneCall size={15}/>} disabled={!canEdit}
          />
          <EditField
            label="Adresse (Français)" placeholder="Rue, Cité, Ville, Code postal" required fullWidth
            value={form.adresse_fr} onChange={set('adresse_fr')}
            icon={<MapPin size={15}/>} error={errors.adresse_fr} disabled={!canEdit}
          />
          <EditField
            label="العنوان (AR)" placeholder="الشارع، المدينة" arabic fullWidth
            value={form.adresse_ar} onChange={set('adresse_ar')}
            disabled={!canEdit}
          />
        </div>
      </Section>

      {/* ─── 5. Contact en cas de besoin ─── */}
      <Section
        icon={<PhoneCall size={16}/>}
        title="Contact en cas de besoin"
        subtitle="Personne à contacter en cas d'urgence — modifiable"
        accent="amber"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
          <EditField
            label="Nom" placeholder="Nom du contact" required
            value={form.contact_nom} onChange={set('contact_nom')}
            error={errors.contact_nom}
            disabled={!canEdit}
          />
          <EditField
            label="Prénom" placeholder="Prénom du contact" required
            value={form.contact_prenom} onChange={set('contact_prenom')}
            error={errors.contact_prenom}
            disabled={!canEdit}
          />
          <EditField
            label="Affiliation" placeholder="Ex : Parent, Tuteur, Ami"
            value={form.contact_affiliation} onChange={set('contact_affiliation')}
            disabled={!canEdit}
          />
          <EditField
            label="Téléphone" placeholder="Ex : +216 XX XXX XXX" required
            value={form.contact_tel} onChange={set('contact_tel')}
            error={errors.contact_tel}
            disabled={!canEdit}
          />
          <EditField
            label="Adresse" placeholder="Adresse du contact"
            value={form.contact_adresse} onChange={set('contact_adresse')}
            disabled={!canEdit}
            fullWidth
          />
        </div>
      </Section>

      {/* ─── 6. Photo + CIN (slots typés) ─── */}
        </>
      )}
      {activeSection === 'documents' && (
        <>
      <Section
        icon={<Camera size={16}/>}
        title="Photo de profil et carte d'identité"
        subtitle="Photo, CIN face 1 et CIN face 2 obligatoires"
        accent="brand"
      >
        {!data.email_verified && (
          <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Info size={14} className="text-amber-600 shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-800">
              Vérifiez votre email avant de pouvoir téléverser des pièces.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {imageSinglePieces.map(conf => {
            const pj = pieceByType(conf.type)
            const normalizedType = normalizePieceType(conf.type)
            const isPhoto = normalizedType === 'photo'
            const isCinFront = normalizedType === 'cin'
            return (
              <ImageUploadSlot
                key={conf.type}
                type={conf.type}
                title={conf.label}
                description={conf.description}
                icon={isPhoto ? <User size={18}/> : <IdCard size={18}/>}
                accent={isPhoto ? 'blue' : 'brand'}
                piece={pj}
                uploading={uploadingType === normalizedType}
                disabled={!canEdit || !data.email_verified}
                onUpload={file => handleTypedUpload(file, normalizedType)}
                onDelete={() => handleDeletePJ(pj.id, pj.nom_fichier)}
                onView={() => handleViewPiece(pj.id)}
                showOcrStatus={isCinFront}
              />
            )
          })}
        </div>
      </Section>

      {/* ─── 6. Autres pièces (PDF) ─── */}
      <Section
        icon={<FileText size={16}/>}
        title="Pieces jointes configurees"
        subtitle="Relevés de notes, diplômes, attestations… (PDF uniquement)"
        accent="gray"
      >
        {pdfSinglePieces.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            {pdfSinglePieces.map(conf => {
              const pj = pieceByType(conf.type)
              const refused = pj?.statut === 'refusee'
              return (
                <div key={conf.type} className={clsx(
                  'rounded-2xl border-2 overflow-hidden transition-all',
                  refused ? 'border-red-300 bg-red-50/40' : pj ? 'border-emerald-200 bg-emerald-50/30' : 'border-dashed border-fog'
                )}>
                  <header className="flex items-center gap-3 px-4 py-3 border-b border-fog/50 bg-white">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-amber-700 bg-amber-100">
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink uppercase tracking-wide leading-tight truncate">{conf.label}</p>
                      <p className="text-xs text-mist mt-0.5">{conf.description}</p>
                    </div>
                    {conf.required && <Badge color="amber">Obligatoire</Badge>}
                  </header>
                  <div className="p-4">
                    {pj ? (
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-fog/40">
                        <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <FileText size={20} className="text-amber-600"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{pj.nom_fichier}</p>
                          <p className="text-xs text-mist mt-0.5">
                            {(pj.taille_octets / 1024).toFixed(0)} KB
                            {pj.uploaded_at && ` · ${new Date(pj.uploaded_at).toLocaleDateString('fr-FR')}`}
                          </p>
                          {refused && pj.motif_refus && (
                            <p className="mt-1 text-xs text-red-700 leading-relaxed">
                              Motif du refus : {pj.motif_refus}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => handleViewPiece(pj.id)}
                            className="p-2 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white transition-all"
                            title="Voir le document">
                            <Eye size={14}/>
                          </button>
                          {canEdit && (
                            <button type="button" onClick={() => handleDeletePJ(pj.id, pj.nom_fichier)}
                              className="p-2 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white transition-all"
                              title="Supprimer">
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <label className={clsx(
                        'w-full flex flex-col items-center justify-center gap-2 py-7 px-4 rounded-xl text-center transition-all border-2 border-dashed',
                        canEdit && data.email_verified
                          ? 'border-fog hover:border-brand/50 hover:bg-brand/5 cursor-pointer'
                          : 'border-fog/40 bg-ghost/30 cursor-not-allowed opacity-60'
                      )}>
                        <input type="file" accept=".pdf,application/pdf" className="hidden"
                          disabled={!canEdit || !data.email_verified || uploadingType === conf.type}
                          onChange={e => e.target.files[0] && handleTypedUpload(e.target.files[0], normalizePieceType(conf.type))} />
                        <FileUp size={28} className={clsx('transition-colors', uploadingType === conf.type ? 'text-brand animate-bounce' : 'text-fog')} />
                        <p className={clsx('text-sm font-semibold', uploadingType === conf.type ? 'text-brand' : 'text-mist')}>
                          {uploadingType === conf.type ? 'Envoi en cours...' : 'Cliquez pour televerser le PDF'}
                        </p>
                        <p className="text-xs text-fog">PDF uniquement - max {conf.max_mb || 10} MB</p>
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {false && canEdit && data.email_verified && (
          <div
            onDrop={handlePdfDrop} onDragOver={e => e.preventDefault()}
            onClick={() => pdfInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 group',
              uploadingType === 'autre' ? 'border-brand bg-brand/5' : 'border-fog hover:border-brand/50 hover:bg-brand/5'
            )}>
            <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={e => e.target.files[0] && handleTypedUpload(e.target.files[0], 'autre')}
              disabled={uploadingType === 'autre'} />
            <FileUp size={28} className={clsx('mx-auto mb-2 transition-colors', uploadingType === 'autre' ? 'text-brand animate-bounce' : 'text-fog group-hover:text-brand')} />
            <p className={clsx('text-sm font-medium', uploadingType === 'autre' ? 'text-brand' : 'text-mist group-hover:text-ink')}>
              {uploadingType === 'autre' ? 'Envoi en cours...' : 'Upload generique desactive'}
            </p>
            <p className="text-xs text-fog mt-1">PDF uniquement — 10 Mo maximum</p>
          </div>
        )}

        {false && autresPieces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {autresPieces.map(pj => (
              <div key={pj.id} className={clsx(
                'rounded-2xl border-2 overflow-hidden transition-all',
                'border-amber-200 bg-amber-50/30'
              )}>
                <header className="flex items-center gap-3 px-4 py-3 border-b border-amber-200">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-amber-700 bg-amber-100">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink uppercase tracking-wide leading-tight truncate">{pj.nom_fichier}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {(pj.taille_octets / 1024).toFixed(0)} KB
                      {pj.uploaded_at && ` · ${new Date(pj.uploaded_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  <Badge color="blue">Téléversé</Badge>
                </header>
                <div className="p-4">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-fog/40">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-amber-600"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">Document PDF</p>
                      <p className="text-xs text-mist mt-0.5">Cliquez pour visualiser</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => handleViewPiece(pj.id)}
                        className="p-2 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white transition-all"
                        title="Voir le document">
                        <Eye size={14}/>
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => handleDeletePJ(pj.id, pj.nom_fichier)}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white transition-all"
                          title="Supprimer">
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null && (
          <div className="text-center py-6 text-mist">
            <FileText size={26} className="mx-auto mb-2 text-fog"/>
            <p className="text-sm">Upload generique desactive</p>
          </div>
        )}
      </Section>

      {/* ─── Boutons d'action ─── */}
        </>
      )}
      {activeSection === 'submit' && canEdit && (() => {
        // Calcul des éléments manquants : champs + pièces + email
        const missing = []
        if (!data.email_verified) missing.push({ key: 'email', label: 'Vérification de l\'adresse email' })
        missingFormFields.forEach(([k, label]) => missing.push({ key: k, label }))
        missingRequiredPieces.forEach(piece => missing.push({ key: piece.type, label: piece.label }))
        if (!reglementAccepted) missing.push({ key: 'reglement', label: 'Acceptation du reglement interne' })
        const ready = missing.length === 0

        return (
          <div className="bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden">
            {/* Bandeau d'état */}
            <div className={clsx(
              'px-5 py-3.5 border-b flex items-center gap-3 text-sm font-semibold',
              ready
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            )}>
              {ready
                ? <><CheckCircle size={18} className="shrink-0"/>Votre dossier est complet — vous pouvez le soumettre.</>
                : <><AlertCircle size={18} className="shrink-0"/>{missing.length} élément{missing.length > 1 ? 's' : ''} manquant{missing.length > 1 ? 's' : ''} avant soumission</>
              }
            </div>

            {/* Liste des champs/pièces manquants */}
            {!ready && (
              <ul className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-1.5 bg-ghost/30 border-b border-ghost">
                {missing.map(m => (
                  <li key={m.key} className="flex items-center gap-2 text-xs text-ink">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"/>
                    {m.label}
                  </li>
                ))}
              </ul>
            )}

            {/* Boutons d'action */}
            <div className="p-5 flex flex-col gap-4">
              <label className={clsx(
                'flex items-start gap-3 rounded-xl border p-4 transition-all cursor-pointer',
                reglementAccepted
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-fog bg-white hover:border-amber-300 hover:bg-amber-50/30'
              )}>
                <input
                  type="checkbox"
                  checked={reglementAccepted}
                  onChange={e => setReglementAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-fog text-brand focus:ring-brand"
                />
                <span className="text-sm text-ink leading-relaxed">
                  J'atteste avoir lu le <Link to={REGLEMENT_INTERNE_HREF} className="font-semibold text-brand hover:underline">reglement interne de l'institut</Link> et j'accepte de le respecter.
                </span>
              </label>

              <div className="flex flex-wrap gap-3 items-center justify-end">
              <Btn variant="secondary" icon={<Save size={15}/>} loading={saving} onClick={handleSave}>
                Sauvegarder
              </Btn>
              <Btn
                icon={isRejete ? <RefreshCw size={15}/> : <Send size={15}/>}
                loading={submitting} onClick={handleSubmit} variant="success"
                disabled={!ready}
                title={ready ? '' : 'Complétez tous les champs et pièces obligatoires'}
              >
                {isRejete ? 'Resoumettre le dossier' : 'Soumettre le dossier'}
              </Btn>
              </div>
            </div>
          </div>
        )
      })()}
      {activeSection === 'submit' && !canEdit && (
        <Section icon={<CheckCircle size={16}/>} title="Soumission" subtitle="Votre dossier est en lecture seule pour le moment" accent={isValidee ? 'emerald' : 'amber'}>
          <div className="flex items-center gap-3 rounded-xl bg-ghost/40 border border-ghost px-4 py-3">
            <StatutBadge insc={activeInsc} />
            <p className="text-sm text-mist">
              {isValidee
                ? 'Votre inscription est validée. Vous pouvez télécharger le reçu depuis le bandeau en haut de page.'
                : 'Votre dossier est déjà transmis et attend le traitement du responsable.'}
            </p>
          </div>
        </Section>
      )}

      <div className="flex items-center justify-between gap-3">
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => goToSection(-1)}
          disabled={currentSectionIndex <= 0}
        >
          Précédent
        </Btn>
        <div className="flex items-center gap-1">
          {sections.map(section => (
            <span
              key={section.value}
              className={clsx(
                'w-2 h-2 rounded-full',
                activeSection === section.value ? 'bg-brand' : 'bg-fog'
              )}
            />
          ))}
        </div>
        <Btn
          variant="secondary"
          size="sm"
          onClick={() => goToSection(1)}
          disabled={currentSectionIndex >= sections.length - 1}
        >
          Suivant
        </Btn>
      </div>
    </div>
  )
}
