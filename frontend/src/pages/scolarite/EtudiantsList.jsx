/**
 * EtudiantsList — Scolarité v9
 * Liste pure + FicheEtudiantFullscreen en plein écran au clic
 */
import { useEffect, useState, useCallback } from 'react'
import {
  listEtudiants, statsEtudiants, getEtudiant, updateEtudiant,
  deactivateEtudiant, resetInscription, createEtudiant,
  listNiveaux, downloadPJScolarite, viewPJScolarite,
  decideInscriptionScolarite, rejectPJScolarite,
} from '../../services/adminApi'
import FicheEtudiantFullscreen from '../../components/FicheEtudiantFullscreen'
import { Btn, Input, Pagination, SectionHead } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  Search, Plus, RefreshCw, ChevronRight,
  CheckCircle, Clock, XCircle, Users, ArrowLeft,
  IdCard, User, GraduationCap, BookOpen, Globe, Calendar, MapPin,
  Heart, FileText, CreditCard, Fingerprint, Ticket, Tag,
} from 'lucide-react'
import clsx from 'clsx'

// ── Badge statut ──────────────────────────────────────────────
function StatutBadge({ statut }) {
  if (statut === 'validee')    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={9}/>Inscrit</span>
  if (statut === 'soumis')     return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"><Clock size={9}/>Soumis</span>
  if (statut === 'en_attente') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock size={9}/>Re-soumis</span>
  if (statut === 'rejetee')    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200"><XCircle size={9}/>Refusé</span>
  if (statut === 'brouillon')  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">📝 Brouillon</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">Sans dossier</span>
}

// ── Formulaire ajout ──────────────────────────────────────────

/* Champ stylisé avec icône, label, hint, erreur. */
function Field({ icon, label, required, hint, error, children, fullWidth, className }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', fullWidth && 'sm:col-span-2 lg:col-span-3', className)}>
      <label className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink">
        {icon && <span className="text-steel">{icon}</span>}
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error
        ? <p className="text-[0.68rem] text-danger font-semibold">{error}</p>
        : hint && <p className="text-[0.68rem] text-mist">{hint}</p>}
    </div>
  )
}

const FORM_FIELD_CLS = 'w-full border-[1.5px] border-fog rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all bg-white hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-fog'

/* Section visuelle dans le formulaire d'ajout. */
function FormSection({ icon, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-ghost bg-ghost/20 overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-3.5 border-b border-ghost bg-white">
        <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-bold text-sm text-ink">{title}</h3>
          {subtitle && <p className="text-[0.7rem] text-mist mt-0.5">{subtitle}</p>}
        </div>
      </header>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
        {children}
      </div>
    </section>
  )
}

const INITIAL_ADD_FORM = {
  // identifiants
  mat_cin: '', num_inscription: '',
  // identité FR
  nom_fr: '', prenom_fr: '',
  // identité AR
  nom_ar: '', prenom_ar: '',
  // état civil
  sexe: '', situation_familiale: '',
  date_naissance: '', lieu_naiss_fr: '', lieu_naiss_ar: '',
  // administratif
  code_gouvernorat: '', code_type_bac: '',
  num_cnss: '', passeport: '',
  // affectation
  niveau_id: '', cfil: '', lib_filiere: '', lib_filiere_ar: '',
}

function AddForm({ onSuccess, onCancel, niveaux }) {
  const [form, setForm] = useState(INITIAL_ADD_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setL] = useState(false)
  const set = k => e => {
    const v = typeof e === 'string' ? e : e.target.value
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const er = {}
    if (!form.mat_cin.trim())   er.mat_cin   = 'Matricule CIN obligatoire'
    if (!form.nom_fr.trim())    er.nom_fr    = 'Nom obligatoire'
    if (!form.prenom_fr.trim()) er.prenom_fr = 'Prénom obligatoire'
    if (!form.niveau_id)        er.niveau_id = 'Sélectionnez un niveau'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const submit = async e => {
    e.preventDefault()
    if (!validate()) return
    setL(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '' && v != null)
      )
      await createEtudiant(payload)
      toast.success('Étudiant créé avec succès')
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setL(false)
    }
  }

  const errCls = 'border-danger focus:border-danger focus:ring-danger/10'

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* SECTION 1 — Identité administrative */}
      <FormSection icon={<IdCard size={18}/>} title="Identité administrative">
        <Field icon={<Fingerprint size={12}/>} label="Matricule / CIN" required error={errors.mat_cin}>
          <input
            value={form.mat_cin} onChange={set('mat_cin')}
            placeholder="12345678"
            className={clsx(FORM_FIELD_CLS, 'font-mono uppercase tracking-wider', errors.mat_cin && errCls)}
          />
        </Field>
        <Field icon={<Ticket size={12}/>} label="N° d'inscription">
          <input
            value={form.num_inscription} onChange={set('num_inscription')}
            placeholder="24001234"
            className={`${FORM_FIELD_CLS} font-mono`}
          />
        </Field>
      </FormSection>

      {/* SECTION 2 — Identité civile */}
      <FormSection icon={<User size={18}/>} title="Identité civile">
        <Field icon={<User size={12}/>} label="Nom (FR)" required error={errors.nom_fr}>
          <input
            value={form.nom_fr} onChange={set('nom_fr')}
            placeholder="BEN SALAH"
            className={clsx(FORM_FIELD_CLS, 'uppercase', errors.nom_fr && errCls)}
          />
        </Field>
        <Field icon={<User size={12}/>} label="Prénom (FR)" required error={errors.prenom_fr}>
          <input
            value={form.prenom_fr} onChange={set('prenom_fr')}
            placeholder="Mohamed"
            className={clsx(FORM_FIELD_CLS, errors.prenom_fr && errCls)}
          />
        </Field>
        <Field icon={<Globe size={12}/>} label="Sexe">
          <select value={form.sexe} onChange={set('sexe')} className={FORM_FIELD_CLS}>
            <option value="">—</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </Field>
        <Field icon={<User size={12}/>} label="Nom (AR)">
          <input
            value={form.nom_ar} onChange={set('nom_ar')}
            placeholder="اللقب" dir="rtl"
            className={`${FORM_FIELD_CLS} text-right`}
          />
        </Field>
        <Field icon={<User size={12}/>} label="Prénom (AR)">
          <input
            value={form.prenom_ar} onChange={set('prenom_ar')}
            placeholder="الاسم" dir="rtl"
            className={`${FORM_FIELD_CLS} text-right`}
          />
        </Field>
        <Field icon={<Calendar size={12}/>} label="Date de naissance">
          <input
            value={form.date_naissance} onChange={set('date_naissance')}
            placeholder="JJ/MM/AAAA"
            className={FORM_FIELD_CLS}
          />
        </Field>
        <Field icon={<Heart size={12}/>} label="Situation familiale">
          <select
            value={form.situation_familiale} onChange={set('situation_familiale')}
            className={FORM_FIELD_CLS}
          >
            <option value="">—</option>
            <option value="Célibataire">Célibataire</option>
            <option value="Marié(e)">Marié(e)</option>
            <option value="Divorcé(e)">Divorcé(e)</option>
            <option value="Veuf/Veuve">Veuf / Veuve</option>
          </select>
        </Field>
        <Field icon={<MapPin size={12}/>} label="Lieu de naissance (FR)">
          <input
            value={form.lieu_naiss_fr} onChange={set('lieu_naiss_fr')}
            placeholder="Tunis"
            className={FORM_FIELD_CLS}
          />
        </Field>
        <Field icon={<MapPin size={12}/>} label="مكان الولادة (AR)">
          <input
            value={form.lieu_naiss_ar} onChange={set('lieu_naiss_ar')}
            placeholder="تونس" dir="rtl"
            className={`${FORM_FIELD_CLS} text-right`}
          />
        </Field>
      </FormSection>

      {/* SECTION 3 — Données administratives */}
      <FormSection icon={<FileText size={18}/>} title="Données administratives">
        <Field icon={<Globe size={12}/>} label="Code gouvernorat">
          <input
            value={form.code_gouvernorat} onChange={set('code_gouvernorat')}
            placeholder="11"
            className={`${FORM_FIELD_CLS} font-mono`}
          />
        </Field>
        <Field icon={<BookOpen size={12}/>} label="Type de BAC">
          <input
            value={form.code_type_bac} onChange={set('code_type_bac')}
            placeholder="Mathématiques"
            className={FORM_FIELD_CLS}
          />
        </Field>
        <Field icon={<CreditCard size={12}/>} label="N° CNSS">
          <input
            value={form.num_cnss} onChange={set('num_cnss')}
            placeholder="12345678"
            className={`${FORM_FIELD_CLS} font-mono`}
          />
        </Field>
        <Field icon={<IdCard size={12}/>} label="N° Passeport" fullWidth>
          <input
            value={form.passeport} onChange={set('passeport')}
            placeholder="A1234567"
            className={`${FORM_FIELD_CLS} font-mono uppercase`}
          />
        </Field>
      </FormSection>

      {/* SECTION 4 — Affectation académique */}
      <FormSection icon={<GraduationCap size={18}/>} title="Affectation académique">
        <Field icon={<GraduationCap size={12}/>} label="Niveau d'études" required error={errors.niveau_id}>
          <select
            value={form.niveau_id} onChange={set('niveau_id')}
            className={clsx(FORM_FIELD_CLS, errors.niveau_id && errCls)}
          >
            <option value="">— Sélectionner —</option>
            {niveaux.map(n => (
              <option key={n.id} value={n.id}>{n.libelle} {n.code ? `(${n.code})` : ''}</option>
            ))}
          </select>
        </Field>
        <Field icon={<Tag size={12}/>} label="Code filière">
          <input
            value={form.cfil} onChange={set('cfil')}
            placeholder="LFIG"
            className={`${FORM_FIELD_CLS} uppercase font-mono`}
          />
        </Field>
        <Field icon={<BookOpen size={12}/>} label="Libellé de la filière (FR)" fullWidth>
          <input
            value={form.lib_filiere} onChange={set('lib_filiere')}
            placeholder="Licence Fondamentale en Informatique de Gestion"
            className={FORM_FIELD_CLS}
          />
        </Field>
        <Field icon={<BookOpen size={12}/>} label="اسم الشعبة (AR)" fullWidth>
          <input
            value={form.lib_filiere_ar} onChange={set('lib_filiere_ar')}
            placeholder="إجازة أساسية في الإعلامية التصرفية"
            dir="rtl"
            className={`${FORM_FIELD_CLS} text-right`}
          />
        </Field>
      </FormSection>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-ghost mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-mist hover:text-ink hover:bg-ghost transition-all"
        >
          Annuler
        </button>
        <Btn type="submit" loading={loading} icon={<Plus size={14}/>}>
          Créer l'étudiant
        </Btn>
      </div>
    </form>
  )
}

// ── Page principale ───────────────────────────────────────────
// Filtres par statut d'inscription (année en cours)
//  ''            → tous les étudiants
//  'sans_dossier'→ aucun dossier soumis
//  'en_attente'  → soumis, en attente de décision
//  'validee'     → inscrit (validé)
//  'rejetee'     → refusé
const FILTERS = [
  { v: '',             l: 'Tous' },
  { v: 'sans_dossier', l: 'Sans dossier' },
  { v: 'soumis',       l: 'Soumis' },
  { v: 'en_attente',   l: 'Re-soumis' },
  { v: 'validee',      l: 'Inscrits' },
  { v: 'rejetee',      l: 'Refusés' },
]

export default function EtudiantsList() {
  const [data, setData]       = useState({ items: [], total: 0, pages: 1 })
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('')
  const [niveauId, setNiv]    = useState('')
  const [loading, setL]       = useState(true)
  const [selectedId, setSel]  = useState(null)
  const [showForm, setForm]   = useState(false)
  const [niveaux, setNiveaux] = useState([])
  const [stats, setStats]     = useState({ total: 0, en_attente: 0, validee: 0, rejetee: 0, sans_dossier: 0 })

  const load = useCallback(async () => {
    setL(true)
    try {
      const p = {
        page, size: 20,
        ...(search && { search }),
        ...(filter !== '' && { statut_inscription: filter }),
        ...(niveauId !== '' && { niveau_id: niveauId }),
      }
      const res = await listEtudiants(p)
      setData(res.data)
    } catch { toast.error('Erreur') }
    finally { setL(false) }
  }, [page, search, filter, niveauId])

  const loadStats = useCallback(async () => {
    try {
      const sp = niveauId !== '' ? { niveau_id: niveauId } : {}
      const r = await statsEtudiants(sp)
      setStats(r.data)
    } catch { /* silencieux : les badges resteront à 0 */ }
  }, [niveauId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { listNiveaux().then(r => setNiveaux(r.data || [])).catch(() => {}) }, [])

  const loadEtudiant = async (id) => {
    const res = await getEtudiant(id)
    return res.data
  }

  // ── Vue pleine page : formulaire d'ajout ─────────────────────
  if (showForm) {
    return (
      <div>
        <SectionHead
          title="Ajouter un étudiant"
          sub="Créer manuellement un dossier étudiant"
          action={
            <Btn variant="ghost" icon={<ArrowLeft size={14}/>} onClick={() => setForm(false)}>
              Retour à la liste
            </Btn>
          }
        />
        <div className="bg-white rounded-2xl border border-ghost shadow-sm p-6">
          <AddForm
            niveaux={niveaux}
            onCancel={() => setForm(false)}
            onSuccess={() => { setForm(false); load(); loadStats() }}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHead
        title="Étudiants"
        sub={`${data.total} étudiant${data.total !== 1 ? 's' : ''}`}
        action={<>
          <Btn variant="ghost" icon={<RefreshCw size={14}/>} onClick={() => { load(); loadStats() }}>Actualiser</Btn>
          <Btn icon={<Plus size={14}/>} onClick={() => setForm(true)}>Ajouter</Btn>
        </>}
      />

      {/* Tableau principal */}
      <div className="bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden">

        {/* Filtres */}
        <div className="px-5 py-4 border-b border-ghost bg-ghost/20 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] max-w-sm">
            <Input placeholder="Rechercher nom, CIN, filière, email…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} icon={<Search size={14}/>}/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => {
              const count =
                f.v === ''             ? stats.total :
                f.v === 'sans_dossier' ? stats.sans_dossier :
                stats[f.v] ?? 0
              const active = filter === f.v
              return (
                <button key={f.v} onClick={() => { setFilter(f.v); setPage(1) }}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all',
                    active
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : 'bg-white text-mist border-ghost hover:border-fog hover:text-ink'
                  )}>
                  {f.l}
                  <span className={clsx(
                    'text-[0.6rem] px-1.5 py-0.5 rounded-full font-black',
                    active ? 'bg-white/20' : 'bg-ghost text-steel'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
          {/* Filtre par niveau */}
          <select
            value={niveauId}
            onChange={e => { setNiv(e.target.value); setPage(1) }}
            className={clsx(
              'px-3 py-2 rounded-xl text-xs font-bold border transition-all outline-none cursor-pointer',
              niveauId !== ''
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-white text-mist border-ghost hover:border-fog hover:text-ink'
            )}
            title="Filtrer par niveau d'études">
            <option value="">Tous niveaux</option>
            {niveaux.map(n => (
              <option key={n.id} value={n.id}>{n.libelle || n.code}</option>
            ))}
          </select>
        </div>

        {/* En-tête du tableau */}
        <div className="grid grid-cols-[1fr_140px_160px_100px_36px] gap-0 px-5 py-2.5 bg-ghost/30 border-b border-ghost text-[0.68rem] font-black uppercase tracking-wider text-mist">
          <span>Nom / Prénom</span>
          <span>MAT / CIN</span>
          <span>Filière · Niveau</span>
          <span>Statut</span>
          <span/>
        </div>

        {/* Lignes */}
        <div className="divide-y divide-ghost/60">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users size={36} className="text-fog mb-3"/>
              <p className="font-bold text-ink">Aucun résultat</p>
              <p className="text-mist text-sm mt-1">Modifiez vos filtres</p>
            </div>
          ) : data.items.map(e => (
            <div key={e.id}
              onClick={() => setSel(e.id)}
              className="grid grid-cols-[1fr_140px_160px_100px_36px] gap-0 px-5 py-3.5 cursor-pointer hover:bg-brand/3 transition-colors group items-center">

              {/* Nom */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-ghost flex items-center justify-center shrink-0 font-black text-steel group-hover:bg-brand group-hover:text-white transition-all text-sm">
                  {(e.nom_fr?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{e.nom_fr} {e.prenom_fr}</p>
                  {(e.nom_ar || e.prenom_ar) && (
                    <p className="text-xs text-mist truncate" dir="rtl">{e.nom_ar} {e.prenom_ar}</p>
                  )}
                </div>
              </div>

              {/* CIN */}
              <code className="text-xs font-mono text-steel">{e.mat_cin}</code>

              {/* Filière · Niveau */}
              <div>
                <p className="text-xs font-bold text-ink">{e.cfil || '—'}</p>
                {e.lib_filiere && <p className="text-[0.6rem] text-mist truncate max-w-[140px]">{e.lib_filiere}</p>}
              </div>

              {/* Statut d'inscription pour l'année en cours */}
              <StatutBadge statut={e.statut_inscription}/>

              {/* Flèche */}
              <ChevronRight size={15} className="text-fog group-hover:text-brand transition-colors"/>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {!loading && data.pages > 1 && (
          <div className="border-t border-ghost px-4 py-3">
            <Pagination page={page} pages={data.pages} total={data.total} size={20} onChange={setPage}/>
          </div>
        )}
      </div>

      {/* Fiche plein écran */}
      {selectedId && (
        <FicheEtudiantFullscreen
          etudiantId={selectedId}
          onClose={() => { setSel(null); load(); loadStats() }}
          onRefresh={() => { load(); loadStats() }}
          loadFn={loadEtudiant}
          saveFn={(id, form) => updateEtudiant(id, form)}
          deactivateFn={(id) => deactivateEtudiant(id)}
          resetFn={(id) => resetInscription(id)}
          decideFn={(inscId, d) => decideInscriptionScolarite(inscId, d)}
          downloadPJFn={(pjId, nom) => downloadPJScolarite(pjId, nom)}
          viewPJFn={(pjId) => viewPJScolarite(pjId)}
          rejectPJFn={(pjId, motif) => rejectPJScolarite(pjId, motif)}
          role="scolarite"
        />
      )}

    </div>
  )
}
