/**
 * FicheEtudiantFullscreen — v12
 * Fiche technique d'inscription — affichage professionnel pleine page
 * Layout : sections empilées verticalement (full-width), chaque section
 * adapte la largeur des champs au contenu (grilles responsives).
 *
 * Utilisé par les rôles : scolarité et responsable de niveau.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Edit2, Save, AlertTriangle, CheckCircle,
  Clock, XCircle, FileText, Download, RefreshCw,
  User, IdCard, Phone, GraduationCap,
  Paperclip, Shield, Info, Calendar, ArrowLeft,
  Image as ImageIcon, Eye, ScanLine, Camera,
} from 'lucide-react'
import { Btn } from './ui'
import { getPiecesJointesConfigAdmin } from '../services/adminApi'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const ANNEE = '2025/2026'
const FALLBACK_PIECES_CONFIG = {
  default_case: 'nouveau_etudiant',
  cases: {
    nouveau_etudiant: {
      pieces: [
        { type: 'photo', label: 'Photo de profil', format: 'image', required: true },
        { type: 'cin', label: "Carte d'identite (CIN)", format: 'image', required: true },
        { type: 'recu_paiement', label: 'Recu de paiement', format: 'pdf', required: true },
        { type: 'releve_bac', label: 'Releve de notes du BAC', format: 'pdf', required: true },
      ],
    },
  },
}
const N = s => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ')
const normalizePieceType = s => String(s || '').trim().toLowerCase()
const isModif = (snap, orig) => !!orig && N(snap) !== N(orig)

const fmtDate = (d, opts = { dateStyle: 'long' }) =>
  d ? new Date(d).toLocaleDateString('fr-FR', opts) : null

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : null

/* ─── Pill statut ─────────────────────────────────────────── */
function Pill({ statut }) {
  if (statut === 'validee')    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle size={13}/>Inscrit</span>
  if (statut === 'soumis')     return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Clock size={13}/>Soumis</span>
  if (statut === 'en_attente') return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 border border-amber-300"><Clock size={13}/>Re-soumis</span>
  if (statut === 'rejetee')    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-300"><XCircle size={13}/>Refusé</span>
  if (statut === 'brouillon')  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-300">📝 Brouillon</span>
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 border border-gray-200">Sans dossier</span>
}

/* ─── Champ (label + valeur ou input) ────────────────────── */
function Field({
  label, value, locked, arabic, highlight, origValue, fullWidth = false,
  editMode, fieldKey, form, onChange, type, opts,
}) {
  const editable = editMode && !locked
  const val = editable ? (form?.[fieldKey] ?? '') : (value ?? '')
  const empty = val === '' || val === null || val === undefined

  return (
    <div className={clsx('flex flex-col gap-1.5 min-w-0', fullWidth && 'sm:col-span-2 lg:col-span-3 xl:col-span-4')}>
      <div className="flex items-center gap-1.5">
        {locked && <span className="text-gray-300 text-[0.65rem]" title="Champ non modifiable">🔒</span>}
        <label className={clsx(
          'text-[0.65rem] font-bold uppercase tracking-wider leading-none',
          highlight ? 'text-red-600' : 'text-gray-500',
        )}>
          {label}
        </label>
        {highlight && (
          <span className="inline-flex items-center gap-0.5 text-[0.55rem] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded">
            <AlertTriangle size={7}/>MODIFIÉ
          </span>
        )}
      </div>

      {editable ? (
        type === 'select' ? (
          <select
            value={form[fieldKey] ?? ''} onChange={e => onChange(fieldKey, e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        ) : (
          <input dir={arabic ? 'rtl' : 'ltr'}
            value={form[fieldKey] ?? ''} onChange={e => onChange(fieldKey, e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
        )
      ) : (
        <div className={clsx(
          'w-full rounded-lg px-3 py-2 text-sm border min-h-[2.4rem] flex items-center break-words',
          highlight
            ? 'bg-red-50 border-red-200 text-red-900 font-bold'
            : locked
              ? 'bg-gray-50 border-gray-200 text-gray-700 font-mono'
              : empty
                ? 'bg-gray-50 border-dashed border-gray-200 text-gray-300 italic'
                : 'bg-white border-gray-200 text-gray-800',
        )} dir={arabic ? 'rtl' : 'ltr'}>
          <span className="leading-snug w-full break-words">{empty ? 'Non renseigné' : val}</span>
        </div>
      )}

      {highlight && origValue && (
        <p className="text-[0.65rem] text-red-500 leading-tight">
          Valeur d'origine&nbsp;: <span className="font-mono font-semibold">{origValue}</span>
        </p>
      )}
    </div>
  )
}

/* ─── Bloc de section (full width) ─────────────────────────── */
function Section({ icon, title, subtitle, accent = 'gray', children, action }) {
  const headerBg = {
    blue:    'bg-blue-50 border-blue-200',
    gray:    'bg-gray-50 border-gray-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber:   'bg-amber-50 border-amber-200',
    red:     'bg-red-50 border-red-200',
  }[accent] || 'bg-gray-50 border-gray-200'

  const iconColor = {
    blue:    'text-blue-700 bg-blue-100',
    gray:    'text-gray-600 bg-gray-200',
    emerald: 'text-emerald-700 bg-emerald-100',
    amber:   'text-amber-700 bg-amber-100',
    red:     'text-red-700 bg-red-100',
  }[accent] || 'text-gray-600 bg-gray-200'

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <header className={clsx('flex items-center gap-3 px-5 py-3 border-b', headerBg)}>
        {icon && (
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

/* ─── Aperçu image (charge le blob via viewPJFn) ──────────── */
function PieceImagePreview({ piece, viewPJFn, downloadPJFn, rejectPJFn, onRejected, label, accent = 'blue' }) {
  const [url, setUrl]   = useState(null)
  const [error, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!piece || !viewPJFn) { setLoading(false); return }
    let active = true; let blobUrl = null
    setLoading(true); setErr(null)
    viewPJFn(piece.id)
      .then(u => { if (active) { setUrl(u); blobUrl = u; setLoading(false) } })
      .catch(() => { if (active) { setErr('Impossible de charger l\'image'); setLoading(false) } })
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [piece?.id, viewPJFn])

  const accentClasses = {
    blue:    'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber:   'border-amber-200 bg-amber-50',
    red:     'border-red-200 bg-red-50',
  }[accent] || 'border-gray-200 bg-gray-50'

  const ocrBadge = piece && piece.type_document === 'cin' ? (
    piece.ocr_verified
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded-full">
          <CheckCircle size={10}/> OCR vérifié
        </span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full">
          <AlertTriangle size={10}/> À revoir manuellement
        </span>
  ) : null

  const refused = piece?.statut === 'refusee'

  const handleReject = async () => {
    if (!piece || !rejectPJFn) return
    const motif = window.prompt(`Motif du refus pour "${piece.nom_fichier}" :`)
    if (!motif?.trim()) return
    try {
      await rejectPJFn(piece.id, motif.trim())
      toast.success('Motif de refus enregistre')
      onRejected?.()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur lors du refus de la piece')
    }
  }

  return (
    <div className={clsx('rounded-xl border overflow-hidden', refused ? 'border-red-300 bg-red-50' : accentClasses)}>
      <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-700 flex-1">{label}</p>
        {refused && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">
            <XCircle size={10}/> Refusee
          </span>
        )}
        {ocrBadge}
        {piece && rejectPJFn && !refused && (
          <button onClick={handleReject}
            title="Refuser cette piece"
            className="p-1 rounded text-gray-500 hover:text-red-600 transition-colors">
            <XCircle size={13}/>
          </button>
        )}
        {piece && downloadPJFn && (
          <button onClick={() => downloadPJFn(piece.id, piece.nom_fichier)}
            title="Télécharger" className="p-1 rounded text-gray-500 hover:text-blue-600 transition-colors">
            <Download size={13}/>
          </button>
        )}
      </div>
      <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center relative">
        {!piece && (
          <div className="text-center px-4">
            <Camera size={36} className="text-gray-300 mx-auto mb-2"/>
            <p className="text-xs text-gray-500">Non fournie par l'étudiant</p>
          </div>
        )}
        {piece && loading && (
          <RefreshCw size={20} className="text-gray-400 animate-spin"/>
        )}
        {piece && error && (
          <div className="text-center px-4">
            <AlertTriangle size={28} className="text-amber-400 mx-auto mb-1"/>
            <p className="text-xs text-amber-700">{error}</p>
          </div>
        )}
        {piece && !loading && url && (
          <a href={url} target="_blank" rel="noopener" className="block w-full h-full">
            <img src={url} alt={label} className="w-full h-full object-contain bg-white" />
          </a>
        )}
        {piece && !viewPJFn && !loading && !url && (
          <div className="text-center px-4">
            <ImageIcon size={28} className="text-blue-400 mx-auto mb-1"/>
            <p className="text-xs text-gray-600 font-semibold mb-2">{piece.nom_fichier}</p>
            {downloadPJFn && (
              <button onClick={() => downloadPJFn(piece.id, piece.nom_fichier)}
                className="text-xs font-semibold text-blue-600 hover:underline">
                Télécharger pour visualiser
              </button>
            )}
          </div>
        )}
      </div>
      {piece && (
        <div className="px-3 py-2 bg-white border-t border-gray-200">
          <p className="text-xs text-gray-700 truncate font-medium">{piece.nom_fichier}</p>
          <p className="text-[0.65rem] text-gray-400 mt-0.5">
            {(piece.taille_octets / 1024).toFixed(0)} KB
          </p>
          {refused && piece.motif_refus && (
            <p className="mt-2 text-[0.7rem] leading-relaxed text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
              Motif : {piece.motif_refus}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Composant principal ─────────────────────────────────── */
export default function FicheEtudiantFullscreen({
  etudiantId, onClose, onRefresh,
  loadFn, saveFn, deactivateFn, resetFn, decideFn, downloadPJFn, viewPJFn, rejectPJFn,
}) {
  const [data, setData]     = useState(null)
  const [editMode, setEdit] = useState(false)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [deciding, setDec]  = useState(false)
  const [rejectMsg, setRM]  = useState('')
  const [showReject, setSR] = useState(false)
  const [piecesConfig, setPiecesConfig] = useState(FALLBACK_PIECES_CONFIG)
  const bodyRef = useRef(null)

  const KEYS = useMemo(() => [
    'nom_fr','prenom_fr','nom_ar','prenom_ar','sexe','situation_familiale',
    'date_naissance','lieu_naiss_fr','lieu_naiss_ar','statut',
    'code_gouvernorat','code_type_bac','num_cnss','passeport','num_inscription',
    'bac_annee','bac_session','bac_moyenne','bac_mention','bac_section',
    'lib_filiere','lib_filiere_ar','telephone_portable','telephone_fixe',
    'adresse_fr','adresse_ar',
    'contact_nom','contact_prenom','contact_affiliation','contact_adresse','contact_tel',
  ], [])

  const load = useCallback(async () => {
    if (!etudiantId || !loadFn) return
    setData(null); setEdit(false); setSR(false)
    try { setData(await loadFn(etudiantId)) }
    catch { toast.error('Erreur de chargement') }
  }, [etudiantId, loadFn])

  const refreshWithoutJump = useCallback(async () => {
    if (!etudiantId || !loadFn) return
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    try {
      setData(await loadFn(etudiantId))
      requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = scrollTop
      })
    } catch {
      toast.error('Erreur de chargement')
    }
  }, [etudiantId, loadFn])

  const handleRejectPiece = async (pj) => {
    if (!pj || !rejectPJFn) return
    const motif = window.prompt(`Motif du refus pour "${pj.nom_fichier}" :`)
    if (!motif?.trim()) return
    try {
      await rejectPJFn(pj.id, motif.trim())
      toast.success('Motif de refus enregistre')
      await refreshWithoutJump()
      onRefresh?.()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur lors du refus de la piece')
    }
  }

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getPiecesJointesConfigAdmin()
      .then(cfg => setPiecesConfig(cfg || FALLBACK_PIECES_CONFIG))
      .catch(() => setPiecesConfig(FALLBACK_PIECES_CONFIG))
  }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape' && !editMode) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, editMode])

  const insc = data?.inscriptions?.find(i => i.annee_universitaire === ANNEE)

  // Modifications proposées par l'étudiant et en attente de validation.
  // Source unique de vérité : `inscription.proposed_data`. Pour chaque champ
  // présent dans ce dict, on affiche la nouvelle valeur (snap) avec un badge
  // "MODIFIÉ" et la valeur d'origine (= valeur actuelle sur Etudiant).
  const proposed = insc?.proposed_data || {}
  const chg = Object.fromEntries(
    Object.entries(proposed)
      .filter(([k, v]) => v != null && N(v) !== N(data?.[k]))
      .map(([k]) => [k, true])
  )
  const nbChg = Object.keys(chg).length

  const startEdit = () => {
    setForm(KEYS.reduce((a, k) => ({ ...a, [k]: data[k] ?? '' }), {}))
    setEdit(true)
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try { await saveFn(data.id, form); toast.success('Enregistré ✓'); setEdit(false); load(); onRefresh?.() }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const doDeactivate = async () => {
    if (!window.confirm(`Désactiver ${data.nom_fr} ${data.prenom_fr} ?`)) return
    try { await deactivateFn(data.id); toast.success('Désactivé'); onClose(); onRefresh?.() }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const doReset = async () => {
    if (!window.confirm("Réinitialiser l'inscription ?")) return
    try { await resetFn(data.id); toast.success('Réinitialisé'); load(); onRefresh?.() }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const doValider = async () => {
    if (!insc || !window.confirm('Confirmer la validation de cette inscription ?')) return
    setDec(true)
    try { await decideFn(insc.id, { decision: 'valider' }); toast.success('Validé ✓'); load(); onRefresh?.() }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setDec(false) }
  }

  const doRejeter = async () => {
    if (!rejectMsg.trim()) { toast.error('Motif obligatoire'); return }
    setDec(true)
    try {
      await decideFn(insc.id, { decision: 'rejeter', message_rejet: rejectMsg })
      toast.success('Refusé — étudiant notifié'); setSR(false); setRM(''); load(); onRefresh?.()
    }
    catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setDec(false) }
  }

  // Pour les champs modifiés par l'étudiant, on affiche la valeur PROPOSÉE
  // (badge rouge + valeur d'origine = valeur actuelle sur Etudiant en-dessous).
  // Pour les autres, on affiche simplement la valeur officielle de l'Etudiant.
  const fp = (key, extra = {}) => ({
    fieldKey: key,
    value: chg[key] ? proposed[key] : data?.[key],
    editMode, form, onChange: set,
    highlight: !!chg[key],
    origValue: chg[key] ? (data?.[key] || '—') : undefined,
    ...extra,
  })

  if (!data) return createPortal(
    <div className="fixed inset-0 z-[100] bg-gray-100 flex items-center justify-center">
      <div className="text-center text-gray-600">
        <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="font-medium">Chargement du dossier…</p>
      </div>
    </div>,
    document.body,
  )

  // Champs manquants (pour le panneau d'alerte)
  const valueFor = key => proposed[key] ?? data?.[key]
  const missing = [
    !valueFor('telephone_portable') && !valueFor('telephone_fixe') && 'Téléphone',
    !valueFor('adresse_fr') && 'Adresse',
    !valueFor('date_naissance') && 'Date de naissance',
    !valueFor('lieu_naiss_fr') && 'Lieu de naissance',
    !valueFor('code_type_bac') && 'Type BAC',
    !valueFor('contact_nom') && 'Nom du contact',
    !valueFor('contact_prenom') && 'Prénom du contact',
    !valueFor('contact_tel') && 'Téléphone du contact',
    !valueFor('nom_ar') && 'Nom en arabe',
    !data.email_verified && 'Email non vérifié',
  ].filter(Boolean)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#f4f5f7', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ══ BANDEAU IDENTITÉ ═══════════════════════════════════ */}
      <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-5 px-8 py-4 w-full">

          <button onClick={onClose}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-semibold text-sm shrink-0 group">
            <div className="w-9 h-9 rounded-xl border border-gray-200 group-hover:border-gray-300 bg-gray-50 group-hover:bg-white flex items-center justify-center transition-all">
              <ArrowLeft size={17}/>
            </div>
            <span className="hidden sm:inline">Retour</span>
          </button>

          <div className="w-px h-9 bg-gray-200 shrink-0"/>

          {/* Monogramme */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-2xl text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}>
            {(data.nom_fr?.[0] || '?').toUpperCase()}
          </div>

          {/* Identité principale */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <code className="text-xs font-mono font-bold bg-gray-900 text-white px-2.5 py-1 rounded-lg tracking-wider">
                {data.mat_cin}
              </code>
              {data.num_inscription && (
                <code className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                  N° {data.num_inscription}
                </code>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight truncate">
                {data.nom_fr} {data.prenom_fr}
              </h1>
              {(data.nom_ar || data.prenom_ar) && (
                <span className="text-xl text-gray-400 font-normal truncate" dir="rtl">
                  {data.nom_ar} {data.prenom_ar}
                </span>
              )}
              {nbChg > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  <AlertTriangle size={11}/>
                  {nbChg} modification{nbChg > 1 ? 's' : ''} proposée{nbChg > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {data.cfil && (
                <span className="text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded-lg">
                  {data.cfil}
                </span>
              )}
              {data.niveau?.code && (
                <span className="text-xs font-bold bg-teal-700 text-white px-2.5 py-1 rounded-lg capitalize">
                  {data.niveau.code}
                </span>
              )}
              <Pill statut={insc?.statut}/>
              {!data.is_active && (
                <span className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-full">Compte inactif</span>
              )}
              <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full border',
                data.email_verified
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
              )}>
                {data.email_verified ? '✓ Email vérifié' : '⚠ Email non vérifié'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {!editMode ? (
              <>
                {saveFn && (
                  <Btn size="sm" variant="secondary" icon={<Edit2 size={13}/>} onClick={startEdit}>
                    Modifier
                  </Btn>
                )}
                {resetFn && insc && (
                  <Btn size="sm" variant="ghost" onClick={doReset} className="text-amber-600">
                    Réinitialiser
                  </Btn>
                )}
                {deactivateFn && data.is_active && (
                  <Btn size="sm" variant="ghost" onClick={doDeactivate} className="text-red-500">
                    Désactiver
                  </Btn>
                )}
              </>
            ) : (
              <>
                <Btn size="sm" variant="ghost" icon={<X size={13}/>} onClick={() => setEdit(false)}>Annuler</Btn>
                <Btn size="sm" icon={<Save size={13}/>} loading={saving} onClick={save}>Enregistrer</Btn>
              </>
            )}
            <button onClick={onClose}
              className="ml-1 w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
              <X size={18}/>
            </button>
          </div>
        </div>
      </div>

      {/* ══ CORPS — sections empilées en pleine largeur ════════ */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-6 flex flex-col gap-5">

          {/* ─── Statut du dossier (full width) ─────────────── */}
          <Section
            icon={<FileText size={16}/>}
            title={`Dossier d'inscription — ${ANNEE}`}
            subtitle={insc
              ? `Soumis le ${fmtDate(insc.date_inscription)}`
              : "L'étudiant n'a pas encore soumis son dossier"}
            accent={
              insc?.statut === 'validee' ? 'emerald' :
              insc?.statut === 'soumis' ? 'blue' :
              insc?.statut === 'en_attente' ? 'amber' :
              insc?.statut === 'rejetee' ? 'red' : 'gray'
            }
            action={<Pill statut={insc?.statut}/>}
          >
            {!insc ? (
              <div className="text-center py-6">
                <FileText size={32} className="text-gray-300 mx-auto mb-2"/>
                <p className="text-sm font-semibold text-gray-500">Aucun dossier soumis pour {ANNEE}</p>
                <p className="text-xs text-gray-400 mt-1">L'étudiant doit compléter et soumettre son inscription depuis son espace.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-wider">Statut</p>
                  <p className="text-sm font-bold text-gray-800">
                    {insc.statut === 'validee' ? 'Inscription validée' :
                     insc.statut === 'soumis' ? 'Soumis — en attente de traitement' :
                     insc.statut === 'en_attente' ? 'Re-soumis — en attente de traitement' :
                     insc.statut === 'rejetee' ? 'Dossier refusé' : '—'}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-wider">Date de soumission</p>
                  <p className="text-sm text-gray-700">{fmtDateTime(insc.date_inscription) || '—'}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-wider">Date de traitement</p>
                  <p className="text-sm text-gray-700">{fmtDateTime(insc.traite_le) || 'Non traité'}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-wider">Année universitaire</p>
                  <p className="text-sm text-gray-700">{insc.annee_universitaire}</p>
                </div>
                {insc.message_rejet && (
                  <div className="md:col-span-2 lg:col-span-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-[0.65rem] font-bold text-red-600 uppercase tracking-wider mb-1">Motif du refus</p>
                    <p className="text-sm text-red-800 leading-relaxed">{insc.message_rejet}</p>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ─── Alerte modifications proposées par l'étudiant ─── */}
          {/*
          {nbChg > 0 && (
            <Section
              icon={<AlertTriangle size={16}/>}
              title={`${nbChg} modification${nbChg > 1 ? 's' : ''} proposée${nbChg > 1 ? 's' : ''} par l'étudiant`}
              subtitle="Ces changements ne seront appliqués qu'après votre validation. Vérifiez avec la pièce d'identité avant de décider."
              accent="red"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.keys(chg).map(k => {
                  const lbl = {
                    nom_fr: 'Nom (FR)', prenom_fr: 'Prénom (FR)',
                    nom_ar: 'Nom (AR)', prenom_ar: 'Prénom (AR)',
                    date_naissance: 'Date de naissance',
                    lieu_naiss_fr: 'Lieu de naissance (FR)',
                    lieu_naiss_ar: 'Lieu de naissance (AR)',
                    sexe: 'Sexe', situation_familiale: 'Situation familiale',
                    code_gouvernorat: 'Gouvernorat', code_type_bac: 'Type BAC',
                    bac_annee: 'Année du BAC', bac_session: 'Session du BAC',
                    bac_moyenne: 'Moyenne du BAC', bac_mention: 'Mention du BAC',
                    bac_section: 'Section du BAC',
                    num_cnss: 'N° CNSS', passeport: 'Passeport',
                    telephone_portable: 'Tél. portable', telephone_fixe: 'Tél. fixe',
                    adresse_fr: 'Adresse (FR)', adresse_ar: 'Adresse (AR)',
                    contact_nom: 'Nom du contact', contact_prenom: 'Prénom du contact',
                    contact_affiliation: 'Affiliation du contact',
                    contact_adresse: 'Adresse du contact', contact_tel: 'Téléphone du contact',
                  }[k] || k
                  const arabic = k.endsWith('_ar')
                  return (
                    <div key={k} className="bg-white rounded-lg border border-red-200 p-3">
                      <p className="text-[0.65rem] font-bold text-red-600 uppercase tracking-wider mb-2">{lbl}</p>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.65rem] text-gray-400 w-20 shrink-0 font-semibold uppercase">Actuel</span>
                          <span className="text-sm font-mono text-gray-600 truncate" dir={arabic ? 'rtl' : 'ltr'}>{data?.[k] || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[0.65rem] text-red-500 font-bold w-20 shrink-0 uppercase">Proposé</span>
                          <span className="text-sm font-mono font-bold text-red-800 truncate" dir={arabic ? 'rtl' : 'ltr'}>{proposed[k] || '—'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
          */}

          {/* ─── Section 1 : État civil & identité ──────────── */}
          <Section icon={<User size={16}/>} title="État civil & identité" accent="blue">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="MAT / CIN"      value={data.mat_cin} fieldKey="mat_cin" editMode={false} locked/>
              <Field label="N° Inscription" {...fp('num_inscription')}/>
              <Field label="Nom (FR)"           {...fp('nom_fr')}/>
              <Field label="Prénom (FR)"        {...fp('prenom_fr')}/>
              <Field label="الاسم"              {...fp('nom_ar',    { arabic: true })}/>
              <Field label="اللقب"              {...fp('prenom_ar', { arabic: true })}/>
              <Field label="Sexe"               {...fp('sexe', { type: 'select', opts: ['','M','F'] })}/>
              <Field label="Situation familiale" {...fp('situation_familiale')}/>
              <Field label="Statut civil"       {...fp('statut')}/>
              <Field label="Date de naissance"  {...fp('date_naissance')}/>
              <Field label="Code gouvernorat"   {...fp('code_gouvernorat')}/>
              <Field label="Lieu de naissance (FR)" {...fp('lieu_naiss_fr')}/>
              <Field label="مكان الولادة (AR)"  {...fp('lieu_naiss_ar', { arabic: true, fullWidth: true })}/>
              
            </div>
          </Section>

          {/* ─── Section 2 : Coordonnées ────────────────────── */}
          <Section icon={<Phone size={16}/>} title="Coordonnées" accent="gray">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="Email" value={data.email} fieldKey="email" editMode={false} locked fullWidth/>
              <Field label="Téléphone portable" {...fp('telephone_portable')}/>
              <Field label="Téléphone portable 2"     {...fp('telephone_fixe')}/>
              <Field label="Adresse (FR)"       {...fp('adresse_fr', { fullWidth: true })}/>
              <Field label="العنوان (AR)"       {...fp('adresse_ar', { arabic: true, fullWidth: true })}/>
            </div>
          </Section>

          {/* ─── Section 3 : Baccalauréat ────────────────────── */}
          <Section
            icon={<GraduationCap size={16}/>}
            title="Baccalauréat"
            subtitle="Champs à vérifier par la scolarité avant validation"
            accent="blue"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-5 gap-y-4">
              <Field label="Année du BAC"  {...fp('bac_annee')}/>
              <Field label="Session"       {...fp('bac_session')}/>
              <Field label="Moyenne"       {...fp('bac_moyenne')}/>
              <Field label="Mention"       {...fp('bac_mention')}/>
              <Field label="Section"       {...fp('bac_section')}/>
            </div>
          </Section>

          {/* ─── Section 5 : Contact en cas de besoin ────────── */}
          <Section
            icon={<Phone size={16}/>}
            title="Contact en cas de besoin"
            subtitle="Personne à contacter si la scolarité a besoin d'un contact d'urgence"
            accent="amber"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="Nom"         {...fp('contact_nom')}/>
              <Field label="Prénom"      {...fp('contact_prenom')}/>
              <Field label="Affiliation" {...fp('contact_affiliation')}/>
              <Field label="Téléphone"   {...fp('contact_tel')}/>
              <Field label="Adresse"     {...fp('contact_adresse', { fullWidth: true })}/>
            </div>
          </Section>

          {/* ─── Section 6 : Filière d'études ───────────────── */}
          <Section icon={<GraduationCap size={16}/>} title="Filière d'études" accent="gray">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="Code filière" value={data.cfil} fieldKey="cfil" editMode={false} locked/>
              <Field label="Niveau"
                value={data.niveau?.libelle || data.niveau?.code} fieldKey="_niv" editMode={false} locked/>
              <Field label="Libellé filière (FR)" {...fp('lib_filiere', { fullWidth: true })}/>
              <Field label="اسم الشعبة (AR)"      {...fp('lib_filiere_ar', { arabic: true, fullWidth: true })}/>
            </div>
          </Section>

          {/* ─── Section 5 : Photo + CIN (aperçus) ──────────── */}
          {(() => {
            const pieces = insc?.pieces_jointes || []
            const photo  = pieces.find(p => p.type_document === 'photo') || null
            const cin    = pieces.find(p => p.type_document === 'cin')   || null
            const currentPiecesCase = piecesConfig.cases?.[piecesConfig.default_case] || FALLBACK_PIECES_CONFIG.cases.nouveau_etudiant
            const documentConfigs = (currentPiecesCase.pieces || []).filter(p => p.format === 'pdf')
            const pieceForType = type => pieces.find(p => normalizePieceType(p.type_document) === normalizePieceType(type)) || null
            const documentSlots = documentConfigs.map(conf => ({ conf, piece: pieceForType(conf.type) }))
            const cinAccent = cin
              ? (cin.ocr_verified ? 'emerald' : 'amber')
              : 'red'
            return (
              <>
                <Section
                  icon={<IdCard size={16}/>}
                  title="Photo et carte d'identité"
                  subtitle={cin
                    ? (cin.ocr_verified
                        ? "Carte d'identité vérifiée par OCR — cohérente avec les données saisies"
                        : "Carte d'identité téléversée — vérification OCR partielle, à revoir manuellement")
                    : "Carte d'identité non téléversée par l'étudiant"}
                  accent="blue"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <PieceImagePreview
                      piece={photo}
                      viewPJFn={viewPJFn}
                      downloadPJFn={downloadPJFn}
                      rejectPJFn={rejectPJFn}
                      onRejected={async () => { await refreshWithoutJump(); onRefresh?.() }}
                      label="Photo de profil"
                      accent="blue"
                    />
                    <PieceImagePreview
                      piece={cin}
                      viewPJFn={viewPJFn}
                      downloadPJFn={downloadPJFn}
                      rejectPJFn={rejectPJFn}
                      onRejected={async () => { await refreshWithoutJump(); onRefresh?.() }}
                      label="Carte d'identité (CIN)"
                      accent={cinAccent}
                    />
                  </div>

                  {cin && cin.ocr_message && (
                    <div className={clsx(
                      'mt-4 flex items-start gap-3 px-4 py-3 rounded-xl text-xs',
                      cin.ocr_verified
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border border-amber-200 text-amber-800',
                    )}>
                      <ScanLine size={14} className={cin.ocr_verified ? 'text-emerald-600 mt-0.5' : 'text-amber-600 mt-0.5'}/>
                      <div className="flex-1 leading-relaxed">
                        <p className="font-bold mb-0.5 uppercase tracking-wider text-[0.65rem]">
                          Diagnostic OCR (Tesseract)
                        </p>
                        <p>{cin.ocr_message}</p>
                      </div>
                    </div>
                  )}
                </Section>

                {/* ─── Section 5b : Autres pièces (PDF) ──────────── */}
                <Section
                  icon={<Paperclip size={16}/>}
                  title="Pieces jointes configurees"
                  subtitle="Chaque document est separe selon le type defini dans le fichier de configuration"
                  accent="gray"
                >
                  {documentSlots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {documentSlots.map(({ conf, piece: pj }) => (
                        <div key={conf.type}
                          className={clsx(
                            'flex items-center gap-3 p-3 bg-white border rounded-xl hover:shadow-sm transition-all',
                            !pj
                              ? 'border-dashed border-gray-300 bg-gray-50'
                              : pj.statut === 'refusee'
                              ? 'border-red-300 bg-red-50/40'
                              : 'border-gray-200 hover:border-blue-300'
                          )}>
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                            <FileText size={18} className="text-red-500"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{conf.label}</p>
                              {!pj && conf.required && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full">
                                  Manquant
                                </span>
                              )}
                              {pj?.statut === 'refusee' && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">
                                  <XCircle size={9}/> Refusee
                                </span>
                              )}
                            </div>
                            <p className="text-[0.65rem] text-gray-400 mt-0.5">
                              {pj ? (
                                <>
                                  {pj.nom_fichier} - {(pj.taille_octets / 1024).toFixed(0)} KB
                                  {pj.uploaded_at && <> · {fmtDate(pj.uploaded_at, { dateStyle: 'medium' })}</>}
                                </>
                              ) : (
                                conf.description || 'Document non fourni'
                              )}
                            </p>
                            {pj?.statut === 'refusee' && pj.motif_refus && (
                              <p className="mt-1 text-[0.68rem] leading-relaxed text-red-700">
                                Motif : {pj.motif_refus}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {pj && rejectPJFn && pj.statut !== 'refusee' && (
                              <button onClick={() => handleRejectPiece(pj)}
                                title="Refuser cette piece"
                                className="p-2 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white transition-all">
                                <XCircle size={14}/>
                              </button>
                            )}
                            {pj && viewPJFn && (
                              <button onClick={() => {
                                viewPJFn(pj.id).then(url => window.open(url, '_blank'))
                              }}
                                title="Ouvrir dans un nouvel onglet"
                                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white transition-all">
                                <Eye size={14}/>
                              </button>
                            )}
                            {pj && downloadPJFn && (
                              <button onClick={() => downloadPJFn(pj.id, pj.nom_fichier)}
                                title="Télécharger"
                                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white transition-all">
                                <Download size={14}/>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Paperclip size={26} className="text-gray-300 mx-auto mb-2"/>
                      <p className="text-sm text-gray-500">Aucun autre document joint</p>
                    </div>
                  )}
                </Section>
              </>
            )
          })()}

          {/* ─── Section 6 : Champs manquants / Complétude ──── */}
          {!editMode && (
            missing.length > 0 ? (
              <Section
                icon={<Info size={16}/>}
                title={`${missing.length} champ${missing.length > 1 ? 's' : ''} manquant${missing.length > 1 ? 's' : ''}`}
                subtitle="Données non renseignées par l'étudiant"
                accent="amber"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {missing.map(x => (
                    <div key={x} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"/>
                      <span className="text-sm text-amber-800 font-medium">{x}</span>
                    </div>
                  ))}
                </div>
              </Section>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle size={18} className="text-emerald-600 shrink-0"/>
                <p className="text-sm font-semibold text-emerald-800">
                  Toutes les données essentielles sont renseignées.
                </p>
              </div>
            )
          )}

          {/* ─── Section 7 : Informations du compte ────────── */}
          <Section icon={<Calendar size={16}/>} title="Informations du compte" accent="gray">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <Field label="Compte créé le"
                value={fmtDateTime(data.created_at)} editMode={false} locked/>
              <Field label="Mis à jour le"
                value={fmtDateTime(data.updated_at)} editMode={false} locked/>
              <Field label="Email vérifié le"
                value={fmtDateTime(data.email_verified_at)} editMode={false} locked/>
              <Field label="Inscription complétée le"
                value={fmtDateTime(data.completed_at)} editMode={false} locked/>
            </div>
          </Section>

          {/* ─── Décision responsable (en fin de page après revue complète) ── */}
          {decideFn && (insc?.statut === 'soumis' || insc?.statut === 'en_attente') && (
            <Section
              icon={<Shield size={16}/>}
              title="Décision du responsable"
              subtitle="Validez ou refusez le dossier après vérification des données et pièces jointes"
              accent="blue"
            >
              {!showReject ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={doValider} disabled={deciding}
                    className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-all disabled:opacity-50 group">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      {deciding
                        ? <RefreshCw size={20} className="text-white animate-spin"/>
                        : <CheckCircle size={22} className="text-white"/>}
                    </div>
                    <div className="text-left">
                      <p className="text-base font-bold text-emerald-800">Valider l'inscription</p>
                      <p className="text-xs text-emerald-700">L'étudiant sera marqué comme inscrit</p>
                    </div>
                  </button>
                  <button onClick={() => setSR(true)}
                    className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-400 transition-all group">
                    <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <XCircle size={22} className="text-white"/>
                    </div>
                    <div className="text-left">
                      <p className="text-base font-bold text-red-800">Refuser le dossier</p>
                      <p className="text-xs text-red-700">L'étudiant pourra corriger et resoumettre</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-w-3xl">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <XCircle size={15} className="text-red-500"/>
                    Motif du refus <span className="text-red-500">*</span>
                  </p>
                  <textarea rows={4} value={rejectMsg} onChange={e => setRM(e.target.value)}
                    placeholder="Précisez le motif du refus à l'étudiant…"
                    className="w-full border border-red-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 resize-none outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-white"/>
                  <p className="text-xs text-gray-400">Ce message sera envoyé par email à l'étudiant.</p>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => { setSR(false); setRM('') }}>
                      Annuler
                    </Btn>
                    <Btn size="sm" variant="danger" icon={<XCircle size={13}/>} loading={deciding} onClick={doRejeter}>
                      Confirmer le refus
                    </Btn>
                  </div>
                </div>
              )}
            </Section>
          )}

        </div>
      </div>

      {/* ══ BARRE INFÉRIEURE ═══════════════════════════════════ */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-2 flex items-center gap-3">
        <kbd className="bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-xs font-mono text-gray-500">Échap</kbd>
        <span className="text-xs text-gray-400">pour fermer</span>
        <span className="text-gray-200 mx-1">·</span>
        <span className="text-xs text-gray-400 truncate">
          Dossier de <strong className="text-gray-600">{data.nom_fr} {data.prenom_fr}</strong>
          {data.cfil && <> — <strong className="text-gray-600">{data.cfil}</strong></>}
          {data.niveau?.code && <> · <strong className="text-gray-600 capitalize">{data.niveau.code}</strong></>}
        </span>
      </div>
    </div>,
    document.body,
  )
}
