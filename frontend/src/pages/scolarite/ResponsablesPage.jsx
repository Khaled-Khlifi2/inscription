/**
 * ResponsablesPage — v11
 * Gestion complète des responsables de niveau par la scolarité
 * Layout : tableau principal + panneau de détail/édition latéral (split-view)
 */
import { useEffect, useState, useCallback } from 'react'
import {
  listResponsables, createResponsable, updateResponsable,
  deactivateResponsable, reactivateResponsable,
  listNiveaux, createNiveau,
} from '../../services/adminApi'
import { Btn, SectionHead, Modal } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  Plus, Edit2, Save, X, RefreshCw,
  ShieldCheck, ShieldOff, GraduationCap,
  Mail, User, Lock, Eye, EyeOff,
  CheckCircle, ChevronRight, Tag, Layers,
} from 'lucide-react'
import clsx from 'clsx'

/* ── Couleurs par niveau ─────────────────────────────────────
   Codes connus → couleur fixe.
   Codes libres (doctorat, prépa, …) → palette assignée déterministiquement
   par hash du code (même couleur à chaque rendu). */
const NIVEAU_COLORS = {
  licence:   { bg: 'bg-blue-600',   soft: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200'   },
  ingenieur: { bg: 'bg-violet-600', soft: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200' },
  master:    { bg: 'bg-teal-700',   soft: 'bg-teal-50',   text: 'text-teal-800',   border: 'border-teal-200'   },
}
const FALLBACK_PALETTE = [
  { bg: 'bg-amber-600',   soft: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200'   },
  { bg: 'bg-rose-600',    soft: 'bg-rose-50',    text: 'text-rose-800',    border: 'border-rose-200'    },
  { bg: 'bg-emerald-600', soft: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  { bg: 'bg-indigo-600',  soft: 'bg-indigo-50',  text: 'text-indigo-800',  border: 'border-indigo-200'  },
  { bg: 'bg-fuchsia-600', soft: 'bg-fuchsia-50', text: 'text-fuchsia-800', border: 'border-fuchsia-200' },
  { bg: 'bg-cyan-700',    soft: 'bg-cyan-50',    text: 'text-cyan-800',    border: 'border-cyan-200'    },
  { bg: 'bg-orange-600',  soft: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-200'  },
  { bg: 'bg-lime-700',    soft: 'bg-lime-50',    text: 'text-lime-800',    border: 'border-lime-200'    },
]
function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
const nColors = code => {
  if (!code) return { bg: 'bg-gray-500', soft: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
  const k = code.toLowerCase()
  if (NIVEAU_COLORS[k]) return NIVEAU_COLORS[k]
  return FALLBACK_PALETTE[hashCode(k) % FALLBACK_PALETTE.length]
}

/* ── Badge niveau ───────────────────────────────────────────── */
function NiveauBadge({ code, libelle }) {
  const c = nColors(code)
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border capitalize', c.soft, c.text, c.border)}>
      <GraduationCap size={11}/>{libelle || code}
    </span>
  )
}

/* ── Badge statut actif/inactif ─────────────────────────────── */
function ActiveBadge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={9}/>Actif</span>
    : <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"><ShieldOff size={9}/>Inactif</span>
}

/* ── Champ avec label ────────────────────────────────────────── */
function FormField({ label, value, onChange, type = 'text', required, placeholder, icon, hint }) {
  const [showPwd, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          type={isPassword ? (showPwd ? 'text' : 'password') : type}
          value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className={clsx(
            'w-full border-[1.5px] border-gray-200 rounded-xl py-2.5 text-sm text-gray-800',
            'outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white',
            icon ? 'pl-10 pr-4' : 'px-3.5',
            isPassword && 'pr-10'
          )}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
            {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
          </button>
        )}
      </div>
      {hint && <p className="text-[0.65rem] text-gray-400">{hint}</p>}
    </div>
  )
}

/* ── Panneau détail / édition ────────────────────────────────── */
function PanneauResponsable({ responsable, niveaux, onClose, onRefresh }) {
  const isNew = !responsable
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (responsable) {
      setForm({
        nom:       responsable.nom,
        prenom:    responsable.prenom,
        email:     responsable.email,
        password:  '',
        niveau_id: String(responsable.niveau_id),
      })
    } else {
      setForm({ nom: '', prenom: '', email: '', password: '', niveau_id: '' })
    }
  }, [responsable])

  const save = async () => {
    if (!form.nom?.trim() || !form.prenom?.trim() || !form.email?.trim() || !form.niveau_id) {
      toast.error('Tous les champs obligatoires doivent être remplis')
      return
    }
    if (isNew && !form.password?.trim()) {
      toast.error('Le mot de passe est obligatoire pour un nouveau compte')
      return
    }
    setSaving(true)
    try {
      const payload = {
        nom:       form.nom.trim(),
        prenom:    form.prenom.trim(),
        email:     form.email.trim(),
        niveau_id: parseInt(form.niveau_id),
      }
      if (form.password?.trim()) payload.password = form.password.trim()

      if (isNew) await createResponsable(payload)
      else       await updateResponsable(responsable.id, payload)

      toast.success(isNew ? 'Responsable créé ✓' : 'Modifications enregistrées ✓')
      onRefresh()
      if (isNew) onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!window.confirm(`Désactiver ${responsable.nom} ${responsable.prenom} ?`)) return
    try {
      await deactivateResponsable(responsable.id)
      toast.success('Compte désactivé')
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const handleReactivate = async () => {
    try {
      await reactivateResponsable(responsable.id)
      toast.success('Compte réactivé')
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const niveauActuel = niveaux.find(n => n.id === responsable?.niveau_id)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* Header */}
      <div className="shrink-0 px-6 py-5 border-b border-gray-100">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-xl text-white',
            isNew
              ? 'bg-gray-200 text-gray-400'
              : (nColors(responsable?.niveau?.code || niveauActuel?.code).bg)
          )}>
            {isNew ? <Plus size={20}/> : (responsable.nom?.[0] || '?').toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg leading-tight">
              {isNew ? 'Nouveau responsable' : `${responsable.nom} ${responsable.prenom}`}
            </h3>
            {!isNew && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-sm text-gray-500">{responsable.email}</p>
                <ActiveBadge active={responsable.is_active}/>
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

        {/* Info niveau actuel */}
        {!isNew && niveauActuel && (
          <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border', nColors(niveauActuel.code).soft, nColors(niveauActuel.code).border)}>
            <GraduationCap size={16} className={nColors(niveauActuel.code).text}/>
            <div>
              <p className={clsx('text-xs font-black uppercase tracking-wide', nColors(niveauActuel.code).text)}>
                Niveau actuel
              </p>
              <p className={clsx('text-sm font-bold capitalize', nColors(niveauActuel.code).text)}>
                {niveauActuel.libelle}
              </p>
            </div>
          </div>
        )}

        {/* Nom + Prénom */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nom" value={form.nom} onChange={set('nom')} required
            placeholder="Ben Ali" icon={<User size={14}/>}/>
          <FormField label="Prénom" value={form.prenom} onChange={set('prenom')} required
            placeholder="Mohamed" icon={<User size={14}/>}/>
        </div>

        {/* Email */}
        <FormField label="Adresse email" value={form.email} onChange={set('email')}
          type="email" required placeholder="responsable@isi.tn" icon={<Mail size={14}/>}/>

        {/* Mot de passe */}
        <FormField
          label={isNew ? 'Mot de passe' : 'Nouveau mot de passe'}
          value={form.password} onChange={set('password')}
          type="password" required={isNew}
          placeholder={isNew ? 'Minimum 8 caractères' : 'Laisser vide pour ne pas modifier'}
          icon={<Lock size={14}/>}
          hint={!isNew ? 'Laissez vide pour conserver le mot de passe actuel' : null}
        />

        {/* Niveau */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
            Niveau de responsabilité <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {niveaux.map(n => {
              const c = nColors(n.code)
              const selected = form.niveau_id === String(n.id)
              return (
                <label key={n.id}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all',
                    selected ? `${c.soft} ${c.border} shadow-sm` : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                  )}>
                  <input type="radio" name="niveau" value={n.id}
                    checked={selected} onChange={() => set('niveau_id')(String(n.id))}
                    className="sr-only"/>
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', selected ? c.bg : 'bg-gray-200')}>
                    <GraduationCap size={14} className="text-white"/>
                  </div>
                  <div className="flex-1">
                    <p className={clsx('text-sm font-bold capitalize', selected ? c.text : 'text-gray-700')}>{n.code}</p>
                    <p className="text-xs text-gray-500">{n.libelle}</p>
                  </div>
                  {selected && <CheckCircle size={16} className={c.text}/>}
                </label>
              )
            })}
          </div>
        </div>

        {/* Permissions info (nouveau seulement) */}
        {isNew && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-amber-800 mb-1.5">Permissions accordées</p>
            <ul className="text-xs text-amber-700 flex flex-col gap-0.5">
              <li>• Gérer les étudiants du niveau assigné</li>
              <li>• Valider ou rejeter les inscriptions</li>
              <li>• Importer / exporter les étudiants</li>
            </ul>
          </div>
        )}
      </div>

      {/* Actions bas de panneau */}
      <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <Btn icon={<Save size={13}/>} loading={saving} onClick={save} className="flex-1 justify-center">
            {isNew ? 'Créer le responsable' : 'Enregistrer'}
          </Btn>
          <Btn variant="ghost" icon={<X size={13}/>} onClick={onClose} className="justify-center">
            Annuler
          </Btn>
        </div>
        {!isNew && (
          <div className="flex gap-2 pt-1 border-t border-gray-100">
            {responsable.is_active ? (
              <button onClick={handleDeactivate}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors">
                <ShieldOff size={13}/>Désactiver le compte
              </button>
            ) : (
              <button onClick={handleReactivate}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-colors">
                <ShieldCheck size={13}/>Réactiver le compte
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Modal de création d'un nouveau niveau ──────────────────── */
function ModalNouveauNiveau({ open, onClose, onCreated, existingCodes }) {
  const [form, setForm] = useState({ code: '', libelle: '', libelle_ar: '' })
  const [saving, setSaving] = useState(false)

  // Réinitialiser à l'ouverture
  useEffect(() => {
    if (open) setForm({ code: '', libelle: '', libelle_ar: '' })
  }, [open])

  // Slug live : minuscule, alphanumérique + underscore
  const codeSlug = (form.code || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const codeAlreadyExists = codeSlug && existingCodes.includes(codeSlug)

  const submit = async () => {
    if (!codeSlug) return toast.error('Code invalide')
    if (!form.libelle.trim()) return toast.error('Libellé obligatoire')
    if (codeAlreadyExists) return toast.error(`Le code "${codeSlug}" existe déjà`)

    setSaving(true)
    try {
      const { data } = await createNiveau({
        code: codeSlug,
        libelle: form.libelle.trim(),
        libelle_ar: form.libelle_ar.trim() || null,
      })
      toast.success(`Niveau "${data.libelle}" créé ✓`)
      onCreated(data)
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const previewColors = nColors(codeSlug)

  return (
    <Modal open={open} onClose={onClose} title="Créer un nouveau niveau" width={560}>
      <div className="flex flex-col gap-5">
        {/* Aperçu badge */}
        {codeSlug && (
          <div className={clsx(
            'rounded-xl border-2 p-4 flex items-center gap-3',
            previewColors.soft, previewColors.border
          )}>
            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', previewColors.bg)}>
              <Layers size={22} className="text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className={clsx('text-[0.65rem] font-black uppercase tracking-wider', previewColors.text)}>
                Aperçu
              </p>
              <p className={clsx('text-sm font-bold capitalize truncate', previewColors.text)}>
                {form.libelle || codeSlug}
              </p>
              <p className="text-[0.7rem] text-gray-500 font-mono">code: {codeSlug}</p>
            </div>
          </div>
        )}

        <FormField
          label="Code (identifiant interne)"
          value={form.code}
          onChange={v => setForm(f => ({ ...f, code: v }))}
          required
          placeholder="ex: doctorat, prepa, mastere_pro"
          icon={<Tag size={14}/>}
          hint={
            codeAlreadyExists
              ? `⚠ Le code "${codeSlug}" existe déjà`
              : 'Sera normalisé : minuscules, sans accents, espaces → underscore'
          }
        />

        <FormField
          label="Libellé (français)"
          value={form.libelle}
          onChange={v => setForm(f => ({ ...f, libelle: v }))}
          required
          placeholder="ex: Doctorat, Classe préparatoire"
          icon={<GraduationCap size={14}/>}
        />

        <FormField
          label="Libellé arabe (optionnel)"
          value={form.libelle_ar}
          onChange={v => setForm(f => ({ ...f, libelle_ar: v }))}
          placeholder="مثال: دكتوراه"
          icon={<GraduationCap size={14}/>}
        />

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-blue-800 mb-1">À quoi sert un niveau ?</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Un niveau regroupe une filière (licence, master, doctorat, …). Une fois créé,
            vous pouvez assigner des responsables et y rattacher des étudiants
            (manuellement ou par import).
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Btn icon={<Save size={13}/>} loading={saving} onClick={submit} className="flex-1 justify-center">
            Créer le niveau
          </Btn>
          <Btn variant="ghost" icon={<X size={13}/>} onClick={onClose} className="justify-center">
            Annuler
          </Btn>
        </div>
      </div>
    </Modal>
  )
}


/* ── Page principale ─────────────────────────────────────────── */
export default function ResponsablesPage() {
  const [responsables, setR] = useState([])
  const [niveaux, setN]      = useState([])
  const [loading, setL]      = useState(true)
  const [selected, setSel]   = useState(null)   // null = aucun | 'new' | responsable object
  const [search, setSearch]  = useState('')
  const [showNewNiveau, setShowNewNiveau] = useState(false)

  const load = useCallback(async () => {
    setL(true)
    try {
      const [rRes, nRes] = await Promise.all([listResponsables(), listNiveaux()])
      setR(rRes.data); setN(nRes.data)
    } catch { toast.error('Erreur de chargement') }
    finally { setL(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRefresh = () => {
    load()
    // Si on vient de créer, fermer le panneau
    if (selected === 'new') setSel(null)
  }

  const filtered = responsables.filter(r => {
    const q = search.toLowerCase()
    return !search || [r.nom, r.prenom, r.email, r.niveau?.code, r.niveau?.libelle]
      .filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  // Stats par niveau
  const statsByNiveau = niveaux.map(n => ({
    ...n,
    count:  responsables.filter(r => r.niveau_id === n.id).length,
    actifs: responsables.filter(r => r.niveau_id === n.id && r.is_active).length,
  }))

  return (
    <div className="flex flex-col h-full">
      <SectionHead
        title="Responsables de niveau"
        sub={`${responsables.length} responsable${responsables.length !== 1 ? 's' : ''} — ${niveaux.length} niveaux`}
        action={<>
          <Btn variant="ghost" icon={<RefreshCw size={14}/>} onClick={load}>Actualiser</Btn>
          <Btn variant="ghost" icon={<Layers size={14}/>} onClick={() => setShowNewNiveau(true)}>
            Nouveau niveau
          </Btn>
          <Btn icon={<Plus size={14}/>} onClick={() => setSel('new')}>Nouveau responsable</Btn>
        </>}
      />

      {/* Stats par niveau — grille responsive auto-adaptative */}
      <div
        className="grid gap-4 mb-5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {statsByNiveau.map(n => {
          const c = nColors(n.code)
          return (
            <div key={n.id} className={clsx('rounded-2xl border-2 p-4 flex items-center gap-4', c.soft, c.border)}>
              <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', c.bg)}>
                <GraduationCap size={22} className="text-white"/>
              </div>
              <div>
                <p className={clsx('text-xs font-black uppercase tracking-wider', c.text)}>{n.code}</p>
                <p className="font-display text-2xl font-black text-gray-900">{n.count}</p>
                <p className="text-xs text-gray-500">{n.actifs} actif{n.actifs !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Split-view : liste + panneau */}
      <div className={clsx(
        'flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden',
        selected ? 'grid grid-cols-[1fr_400px]' : 'flex flex-col'
      )} style={{ minHeight: 0 }}>

        {/* ── Colonne liste ── */}
        <div className="flex flex-col border-r border-gray-100 min-h-0">

          {/* Barre de recherche */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <User size={14}/>
              </span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un responsable…"
                className="w-full border-[1.5px] border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all"
              />
            </div>
          </div>

          {/* En-tête colonnes */}
          <div className="grid grid-cols-[1fr_160px_100px_40px] px-5 py-2.5 bg-gray-50/30 border-b border-gray-100 text-[0.68rem] font-black uppercase tracking-wider text-gray-400">
            <span>Nom / Prénom</span>
            <span>Niveau</span>
            <span>Statut</span>
            <span/>
          </div>

          {/* Lignes */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100/70">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <GraduationCap size={32} className="text-gray-300 mb-3"/>
                <p className="font-bold text-gray-600 text-sm">
                  {responsables.length === 0 ? 'Aucun responsable créé' : 'Aucun résultat'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {responsables.length === 0 ? 'Cliquez sur "Nouveau responsable" pour commencer' : 'Modifiez votre recherche'}
                </p>
              </div>
            ) : filtered.map(r => {
              const c = nColors(r.niveau?.code)
              const isSelected = selected && selected !== 'new' && selected.id === r.id
              return (
                <div key={r.id}
                  onClick={() => setSel(r)}
                  className={clsx(
                    'grid grid-cols-[1fr_160px_100px_40px] items-center px-5 py-3.5 cursor-pointer transition-all group',
                    isSelected ? 'bg-blue-50 border-r-[3px] border-blue-600' : 'hover:bg-gray-50/70'
                  )}>

                  {/* Nom */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm text-white transition-all',
                      isSelected ? 'bg-blue-600' : r.is_active ? c.bg : 'bg-gray-200'
                    )}>
                      {r.nom?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className={clsx('font-bold text-sm truncate', r.is_active ? 'text-gray-800' : 'text-gray-400')}>
                        {r.nom} {r.prenom}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{r.email}</p>
                    </div>
                  </div>

                  {/* Niveau */}
                  <div>
                    {r.niveau
                      ? <NiveauBadge code={r.niveau.code} libelle={r.niveau.code}/>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </div>

                  {/* Statut */}
                  <ActiveBadge active={r.is_active}/>

                  {/* Flèche */}
                  <ChevronRight size={14} className={clsx(
                    'transition-colors',
                    isSelected ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'
                  )}/>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-400">
              {filtered.length} responsable{filtered.length !== 1 ? 's' : ''}
              {' · '}{responsables.filter(r => r.is_active).length} actif{responsables.filter(r => r.is_active).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Panneau détail / formulaire ── */}
        {selected && (
          <PanneauResponsable
            responsable={selected === 'new' ? null : selected}
            niveaux={niveaux}
            onClose={() => setSel(null)}
            onRefresh={handleRefresh}
          />
        )}

        {/* Placeholder quand rien sélectionné */}
        {!selected && !loading && responsables.length > 0 && (
          <div className="hidden"/>
        )}
      </div>

      {/* Modal création niveau */}
      <ModalNouveauNiveau
        open={showNewNiveau}
        onClose={() => setShowNewNiveau(false)}
        onCreated={() => load()}
        existingCodes={niveaux.map(n => n.code)}
      />
    </div>
  )
}
