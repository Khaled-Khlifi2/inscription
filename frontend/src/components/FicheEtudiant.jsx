/**
 * FicheEtudiant — Composant fiche pleine page
 * Utilisé par la scolarité ET le responsable de niveau
 *
 * Props:
 *  - etudiantId : id de l'étudiant à afficher
 *  - onClose    : callback pour fermer la fiche (retour à la liste)
 *  - onRefresh  : callback pour recharger la liste parente
 *  - getEtudiantFn   : fonction API pour charger l'étudiant
 *  - updateEtudiantFn: fonction API pour modifier (null = lecture seule)
 *  - decideInscriptionFn: fonction API pour décider (null = pas de décision)
 *  - downloadPJFn: fonction API pour télécharger PJ
 *  - role       : 'scolarite' | 'responsable'
 */
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  X, Edit2, Save, CheckCircle, XCircle, Clock,
  User, Phone, MapPin, GraduationCap, FileText,
  Lock, AlertTriangle, Shield, Download, Info,
  RotateCcw, UserX, ArrowLeft,
} from 'lucide-react'
import { Btn } from './ui'
import clsx from 'clsx'

const ANNEE = '2025/2026'

// ── Comparaison insensible casse + accents ───────────────────
function normStr(s) {
  if (!s) return ''
  return s.trim().toUpperCase().replace(/[-']/g, ' ').replace(/\s+/g, ' ')
}

// ── Badge statut ─────────────────────────────────────────────
export function StatutBadge({ statut, size = 'md' }) {
  const p = size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  if (statut === 'validee')    return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 ${p}`}><CheckCircle size={12}/>Inscrit</span>
  if (statut === 'soumis')     return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-300 ${p}`}><Clock size={12}/>Soumis</span>
  if (statut === 'en_attente') return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 ${p}`}><Clock size={12}/>Re-soumis</span>
  if (statut === 'rejetee')    return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-300 ${p}`}><XCircle size={12}/>Refusé</span>
  if (statut === 'brouillon')  return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-300 ${p}`}>📝 Brouillon</span>
  return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-gray-100 text-gray-500 border border-gray-200 ${p}`}>Sans dossier</span>
}

// ── Champ fiche ──────────────────────────────────────────────
function Champ({ label, value, arabic, locked, changed, origValue, editMode, fieldKey, form, onChange, type, opts }) {
  const isChanged = changed && !locked
  const displayVal = editMode && !locked ? (form?.[fieldKey] ?? value ?? '') : (value ?? '')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {locked && <Lock size={9} className="text-fog shrink-0"/>}
        <label className={clsx(
          'text-[0.68rem] font-black uppercase tracking-wider',
          isChanged ? 'text-red-600' : 'text-mist'
        )}>
          {label}
          {isChanged && <span className="ml-1.5 text-[0.6rem] bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full font-bold normal-case tracking-normal">
            ⚠ Modifié
          </span>}
        </label>
      </div>

      {editMode && !locked ? (
        type === 'select' ? (
          <select
            className="border-[1.5px] border-fog rounded-xl px-3.5 py-2.5 text-sm text-ink bg-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
            value={form?.[fieldKey] ?? ''} onChange={e => onChange(fieldKey, e.target.value)}>
            {opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        ) : (
          <input dir={arabic ? 'rtl' : 'ltr'}
            className="border-[1.5px] border-fog rounded-xl px-3.5 py-2.5 text-sm text-ink bg-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
            value={form?.[fieldKey] ?? ''} onChange={e => onChange(fieldKey, e.target.value)}/>
        )
      ) : (
        <div className={clsx(
          'rounded-xl px-3.5 py-2.5 text-sm border',
          isChanged
            ? 'bg-red-50 border-red-200 text-red-900 font-semibold ring-1 ring-red-200'
            : locked
              ? 'bg-ghost/50 border-fog/30 text-steel'
              : value
                ? 'bg-white border-ghost text-ink'
                : 'bg-ghost/30 border-fog/20 text-fog italic'
        )} dir={arabic ? 'rtl' : 'ltr'}>
          {displayVal || 'Non renseigné'}
        </div>
      )}

      {/* Valeur originale si modifiée */}
      {isChanged && origValue && (
        <p className="text-[0.65rem] text-red-500 flex items-center gap-1">
          <span className="font-bold">Valeur SALIMA :</span>
          <span className="font-mono bg-red-50 border border-red-200 px-1.5 rounded">{origValue}</span>
        </p>
      )}
    </div>
  )
}

// ── Séparateur de groupe ─────────────────────────────────────
function Groupe({ icon, title, color = 'gray' }) {
  const colors = {
    blue:  'bg-brand/8 text-brand border-brand/20',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red:   'bg-red-50 text-red-700 border-red-200',
    gray:  'bg-ghost text-steel border-fog/40',
  }
  return (
    <div className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-xs uppercase tracking-wider', colors[color])}>
      {icon} {title}
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────
export default function FicheEtudiant({
  etudiantId, onClose, onRefresh,
  getEtudiantFn, updateEtudiantFn = null,
  decideInscriptionFn = null, downloadPJFn = null,
  deactivateFn = null, resetInscriptionFn = null,
  role = 'scolarite',
}) {
  const [data, setData]         = useState(null)
  const [editMode, setEdit]     = useState(false)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [rejectMsg, setRM]      = useState('')
  const [showReject, setSR]     = useState(false)

  const load = useCallback(async () => {
    setData(null); setEdit(false); setSR(false); setRM('')
    try {
      const r = await getEtudiantFn(etudiantId)
      setData(r.data)
    } catch { toast.error('Erreur de chargement') }
  }, [etudiantId, getEtudiantFn])

  useEffect(() => { load() }, [load])

  const activeInsc = data?.inscriptions?.find(i => i.annee_universitaire === ANNEE)

  // Détection des champs sensibles modifiés (snap vs orig)
  const sensitiveChanges = activeInsc ? {
    nom_fr:         normStr(activeInsc.snap_nom_fr)        !== normStr(activeInsc.orig_nom_fr)        && !!activeInsc.orig_nom_fr,
    prenom_fr:      normStr(activeInsc.snap_prenom_fr)     !== normStr(activeInsc.orig_prenom_fr)     && !!activeInsc.orig_prenom_fr,
    nom_ar:         normStr(activeInsc.snap_nom_ar)        !== normStr(activeInsc.orig_nom_ar)        && !!activeInsc.orig_nom_ar,
    prenom_ar:      normStr(activeInsc.snap_prenom_ar)     !== normStr(activeInsc.orig_prenom_ar)     && !!activeInsc.orig_prenom_ar,
    date_naissance: normStr(activeInsc.snap_date_naissance) !== normStr(activeInsc.orig_date_naissance) && !!activeInsc.orig_date_naissance,
  } : {}

  const nbChanges = Object.values(sensitiveChanges).filter(Boolean).length

  const ALL_FIELDS = [
    'nom_fr','prenom_fr','nom_ar','prenom_ar','sexe','situation_familiale',
    'date_naissance','lieu_naiss_fr','lieu_naiss_ar','statut','code_gouvernorat',
    'code_type_bac','num_cnss','passeport','num_inscription',
    'telephone_portable','telephone_fixe','adresse_fr','adresse_ar',
    'lib_filiere','lib_filiere_ar',
  ]

  const startEdit = () => {
    setForm(ALL_FIELDS.reduce((a, k) => ({ ...a, [k]: data[k] ?? '' }), {}))
    setEdit(true)
  }

  const save = async () => {
    if (!updateEtudiantFn) return
    setSaving(true)
    try {
      await updateEtudiantFn(data.id, Object.fromEntries(Object.entries(form).filter(([,v]) => v !== null)))
      toast.success('Modifications enregistrées ✓')
      setEdit(false); load(); onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleValider = async () => {
    if (!decideInscriptionFn || !activeInsc) return
    if (!window.confirm('Confirmer la validation de cette inscription ?')) return
    setDeciding(true)
    try {
      await decideInscriptionFn(activeInsc.id, { decision: 'valider' })
      toast.success('Inscription validée ✓')
      load(); onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setDeciding(false) }
  }

  const handleRejeter = async () => {
    if (!rejectMsg.trim()) { toast.error('Motif de refus obligatoire'); return }
    setDeciding(true)
    try {
      await decideInscriptionFn(activeInsc.id, { decision: 'rejeter', message_rejet: rejectMsg })
      toast.success('Dossier refusé — étudiant notifié ✓')
      setSR(false); setRM(''); load(); onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setDeciding(false) }
  }

  const chg = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!data) return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-mist">
        <div className="w-10 h-10 border-[3px] border-brand border-t-transparent rounded-full animate-spin"/>
        <p className="text-base font-semibold">Chargement du dossier…</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">

      {/* ══ BARRE SUPÉRIEURE ══ */}
      <div className="shrink-0 border-b border-ghost bg-white shadow-sm">

        {/* Ligne principale */}
        <div className="flex items-center gap-4 px-6 py-4">
          {/* Bouton retour */}
          <button onClick={onClose}
            className="flex items-center gap-2 text-mist hover:text-ink transition-colors font-semibold text-sm shrink-0 group">
            <div className="w-9 h-9 rounded-xl border-2 border-ghost group-hover:border-fog bg-ghost/50 group-hover:bg-white flex items-center justify-center transition-all">
              <ArrowLeft size={17}/>
            </div>
            <span className="hidden sm:inline">Retour à la liste</span>
          </button>

          <div className="w-px h-8 bg-ghost shrink-0"/>

          {/* Avatar + Identité */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/25 to-brand/8 border-2 border-brand/20 flex items-center justify-center shrink-0 shadow-sm">
              <span className="font-display font-black text-brand text-2xl leading-none">
                {(data.nom_fr?.[0] || '?').toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black text-ink leading-tight truncate">
                {data.nom_fr} {data.prenom_fr}
              </h1>
              {(data.nom_ar || data.prenom_ar) && (
                <p className="text-base text-steel mt-0.5 font-medium" dir="rtl">{data.nom_ar} {data.prenom_ar}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <code className="bg-ink text-white text-xs px-2.5 py-1 rounded-lg font-mono font-bold tracking-wider">{data.mat_cin}</code>
                {data.num_inscription && <code className="bg-ghost text-steel text-xs px-2.5 py-1 rounded-lg font-mono">N°{data.num_inscription}</code>}
                {data.cfil && <span className="bg-brand text-white text-xs font-black px-2.5 py-1 rounded-lg">{data.cfil}</span>}
                {data.niveau?.code && <span className="bg-teal-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg capitalize">{data.niveau.code}</span>}
                <StatutBadge statut={activeInsc?.statut} size="md"/>
                {!data.is_active && <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">Inactif</span>}
                {nbChanges > 0 && (
                  <span className="bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={11}/> {nbChanges} donnée{nbChanges > 1 ? 's' : ''} sensible{nbChanges > 1 ? 's' : ''} modifiée{nbChanges > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {updateEtudiantFn && (
              !editMode ? (
                <Btn variant="secondary" icon={<Edit2 size={14}/>} onClick={startEdit}>Modifier</Btn>
              ) : (
                <>
                  <Btn variant="ghost" icon={<X size={14}/>} onClick={() => setEdit(false)}>Annuler</Btn>
                  <Btn icon={<Save size={14}/>} loading={saving} onClick={save}>Enregistrer</Btn>
                </>
              )
            )}
            {deactivateFn && !editMode && (
              <Btn variant="ghost" icon={<UserX size={14}/>} className="text-red-500 hover:text-red-600"
                onClick={async () => {
                  if (!window.confirm(`Désactiver ${data.nom_fr} ${data.prenom_fr} ?`)) return
                  try { await deactivateFn(data.id); toast.success('Désactivé'); onClose(); onRefresh() }
                  catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
                }}>
                Désactiver
              </Btn>
            )}
            {resetInscriptionFn && (activeInsc || data.is_inscription_complete) && !editMode && (
              <Btn variant="ghost" icon={<RotateCcw size={14}/>} className="text-amber-600"
                onClick={async () => {
                  if (!window.confirm("Réinitialiser l'inscription ?")) return
                  try { await resetInscriptionFn(data.id); toast.success('Réinitialisé'); load(); onRefresh() }
                  catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
                }}>
                Réinitialiser
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* ══ CORPS PRINCIPAL — 3 colonnes ══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">

          {/* ─── COLONNE 1 : Identité + Naissance + Admin ─── */}
          <div className="flex flex-col gap-5">

            <Groupe icon={<User size={13}/>} title="Identité" color="blue"/>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Nom (FR)"    value={data.nom_fr}    fieldKey="nom_fr"    form={form} onChange={chg} editMode={editMode}
                changed={sensitiveChanges.nom_fr} origValue={activeInsc?.orig_nom_fr}/>
              <Champ label="Prénom (FR)" value={data.prenom_fr} fieldKey="prenom_fr" form={form} onChange={chg} editMode={editMode}
                changed={sensitiveChanges.prenom_fr} origValue={activeInsc?.orig_prenom_fr}/>
              <Champ label="الاسم (AR)"  value={data.nom_ar}    fieldKey="nom_ar"    form={form} onChange={chg} editMode={editMode} arabic
                changed={sensitiveChanges.nom_ar} origValue={activeInsc?.orig_nom_ar}/>
              <Champ label="اللقب (AR)"  value={data.prenom_ar} fieldKey="prenom_ar" form={form} onChange={chg} editMode={editMode} arabic
                changed={sensitiveChanges.prenom_ar} origValue={activeInsc?.orig_prenom_ar}/>
              <Champ label="Sexe"        value={data.sexe}      fieldKey="sexe"      form={form} onChange={chg} editMode={editMode}
                type="select" opts={['','M','F']}/>
              <Champ label="Situation familiale" value={data.situation_familiale} fieldKey="situation_familiale" form={form} onChange={chg} editMode={editMode}/>
            </div>

            <Groupe icon={<MapPin size={13}/>} title="Naissance & Origine" color="gray"/>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Date de naissance" value={data.date_naissance} fieldKey="date_naissance" form={form} onChange={chg} editMode={editMode}
                changed={sensitiveChanges.date_naissance} origValue={activeInsc?.orig_date_naissance}/>
              <Champ label="Gouvernorat"       value={data.code_gouvernorat} fieldKey="code_gouvernorat" form={form} onChange={chg} editMode={editMode}/>
              <Champ label="Lieu naissance (FR)" value={data.lieu_naiss_fr} fieldKey="lieu_naiss_fr" form={form} onChange={chg} editMode={editMode}/>
              <Champ label="مكان الولادة (AR)"  value={data.lieu_naiss_ar} fieldKey="lieu_naiss_ar" form={form} onChange={chg} editMode={editMode} arabic/>
              <Champ label="Statut civil"      value={data.statut}       fieldKey="statut"       form={form} onChange={chg} editMode={editMode}/>
            </div>
          </div>

          {/* ─── COLONNE 2 : Académique + Contact ─── */}
          <div className="flex flex-col gap-5">

            <Groupe icon={<GraduationCap size={13}/>} title="Données académiques" color="gray"/>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="MAT / CIN"       value={data.mat_cin}         locked/>
              <Champ label="N° Inscription"  value={data.num_inscription} fieldKey="num_inscription" form={form} onChange={chg} editMode={editMode}/>
              <Champ label="Code filière"    value={data.cfil}            locked/>
              <Champ label="Niveau"          value={data.niveau?.libelle || data.niveau?.code} locked/>
              <Champ label="Type BAC"        value={data.code_type_bac}   fieldKey="code_type_bac"   form={form} onChange={chg} editMode={editMode}/>
              <Champ label="N° CNSS"         value={data.num_cnss}        fieldKey="num_cnss"        form={form} onChange={chg} editMode={editMode}/>
              <Champ label="Passeport"       value={data.passeport}       fieldKey="passeport"       form={form} onChange={chg} editMode={editMode}/>
            </div>
            <div className="flex flex-col gap-3">
              <Champ label="Libellé filière (FR)"  value={data.lib_filiere}    fieldKey="lib_filiere"    form={form} onChange={chg} editMode={editMode}/>
              <Champ label="اسم الشعبة (AR)"       value={data.lib_filiere_ar} fieldKey="lib_filiere_ar" form={form} onChange={chg} editMode={editMode} arabic/>
            </div>

            <Groupe icon={<Phone size={13}/>} title="Coordonnées" color="gray"/>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Champ label="Email" value={data.email} locked/>
                </div>
                <div className="mt-5 shrink-0">
                  {data.email_verified
                    ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl">✓ Vérifié</span>
                    : <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl">⚠ Non vérifié</span>
                  }
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Tél. portable" value={data.telephone_portable} fieldKey="telephone_portable" form={form} onChange={chg} editMode={editMode}/>
                <Champ label="Tél. fixe"     value={data.telephone_fixe}     fieldKey="telephone_fixe"     form={form} onChange={chg} editMode={editMode}/>
              </div>
              <Champ label="Adresse (FR)" value={data.adresse_fr} fieldKey="adresse_fr" form={form} onChange={chg} editMode={editMode}/>
              <Champ label="العنوان (AR)" value={data.adresse_ar} fieldKey="adresse_ar" form={form} onChange={chg} editMode={editMode} arabic/>
            </div>
          </div>

          {/* ─── COLONNE 3 : Dossier inscription ─── */}
          <div className="flex flex-col gap-5">

            {/* Alerte données sensibles modifiées */}
            {nbChanges > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <p className="font-black text-red-800 text-sm flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="shrink-0"/>
                  {nbChanges} donnée{nbChanges > 1 ? 's' : ''} sensible{nbChanges > 1 ? 's' : ''} modifiée{nbChanges > 1 ? 's' : ''} par l'étudiant
                </p>
                <div className="flex flex-col gap-1.5">
                  {sensitiveChanges.nom_fr && (
                    <div className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-red-200">
                      <span className="font-bold text-red-700">Nom (FR)</span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-400 font-mono">{activeInsc?.orig_nom_fr}</span>
                        <span className="text-red-800 font-bold font-mono">→ {activeInsc?.snap_nom_fr}</span>
                      </div>
                    </div>
                  )}
                  {sensitiveChanges.prenom_fr && (
                    <div className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-red-200">
                      <span className="font-bold text-red-700">Prénom (FR)</span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-400 font-mono">{activeInsc?.orig_prenom_fr}</span>
                        <span className="text-red-800 font-bold font-mono">→ {activeInsc?.snap_prenom_fr}</span>
                      </div>
                    </div>
                  )}
                  {sensitiveChanges.nom_ar && (
                    <div className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-red-200" dir="rtl">
                      <span className="font-bold text-red-700">الاسم</span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-400 font-mono">{activeInsc?.orig_nom_ar}</span>
                        <span className="text-red-800 font-bold font-mono">← {activeInsc?.snap_nom_ar}</span>
                      </div>
                    </div>
                  )}
                  {sensitiveChanges.prenom_ar && (
                    <div className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-red-200" dir="rtl">
                      <span className="font-bold text-red-700">اللقب</span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-400 font-mono">{activeInsc?.orig_prenom_ar}</span>
                        <span className="text-red-800 font-bold font-mono">← {activeInsc?.snap_prenom_ar}</span>
                      </div>
                    </div>
                  )}
                  {sensitiveChanges.date_naissance && (
                    <div className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-red-200">
                      <span className="font-bold text-red-700">Date de naissance</span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-400 font-mono">{activeInsc?.orig_date_naissance}</span>
                        <span className="text-red-800 font-bold font-mono">→ {activeInsc?.snap_date_naissance}</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[0.68rem] text-red-600 mt-2.5 leading-relaxed">
                  Vérifiez avec la pièce d'identité originale avant de valider.
                </p>
              </div>
            )}

            <Groupe icon={<FileText size={13}/>} title="Dossier d'inscription" color={
              activeInsc?.statut === 'validee' ? 'green' :
              activeInsc?.statut === 'soumis' ? 'blue' :
              activeInsc?.statut === 'en_attente' ? 'amber' :
              activeInsc?.statut === 'rejetee' ? 'red' : 'gray'
            }/>

            {!activeInsc ? (
              <div className="bg-ghost/50 border border-fog/30 rounded-2xl p-6 text-center">
                <FileText size={28} className="text-fog mx-auto mb-3"/>
                <p className="font-bold text-ink text-sm">Aucun dossier soumis</p>
                <p className="text-xs text-mist mt-1">L'étudiant n'a pas encore soumis son inscription pour {ANNEE}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Statut */}
                <div className={clsx('rounded-2xl border p-4 flex items-center gap-3',
                  activeInsc.statut === 'validee'    ? 'bg-emerald-50 border-emerald-200' :
                  activeInsc.statut === 'soumis'     ? 'bg-blue-50 border-blue-200'       :
                  activeInsc.statut === 'en_attente' ? 'bg-amber-50 border-amber-200'    :
                  activeInsc.statut === 'rejetee'    ? 'bg-red-50 border-red-200'         : ''
                )}>
                  {activeInsc.statut === 'validee'    && <CheckCircle size={20} className="text-emerald-600 shrink-0"/>}
                  {activeInsc.statut === 'soumis'     && <Clock size={20} className="text-blue-600 shrink-0"/>}
                  {activeInsc.statut === 'en_attente' && <Clock size={20} className="text-amber-600 shrink-0"/>}
                  {activeInsc.statut === 'rejetee'    && <XCircle size={20} className="text-red-600 shrink-0"/>}
                  <div>
                    <p className="font-bold text-ink text-sm">
                      {activeInsc.statut === 'validee'    ? 'Dossier validé — Inscrit'                  :
                       activeInsc.statut === 'soumis'     ? 'Soumis — En attente de décision'           :
                       activeInsc.statut === 'en_attente' ? 'Re-soumis — En attente de décision'        :
                       activeInsc.statut === 'rejetee'    ? 'Dossier refusé' : '—'}
                    </p>
                    {activeInsc.date_inscription && (
                      <p className="text-xs text-mist mt-0.5">
                        Soumis le {new Date(activeInsc.date_inscription).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                      </p>
                    )}
                    {activeInsc.traite_le && (
                      <p className="text-xs text-mist">
                        Traité le {new Date(activeInsc.traite_le).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                      </p>
                    )}
                  </div>
                </div>

                {activeInsc.message_rejet && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-[0.68rem] font-black text-mist uppercase tracking-wider mb-1">Motif du refus</p>
                    <p className="text-sm text-red-800 leading-relaxed">{activeInsc.message_rejet}</p>
                  </div>
                )}

                {/* Pièces jointes */}
                {activeInsc.pieces_jointes?.length > 0 && (
                  <div>
                    <p className="text-[0.68rem] font-black text-mist uppercase tracking-wider mb-2">
                      Pièces jointes ({activeInsc.pieces_jointes.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {activeInsc.pieces_jointes.map(pj => (
                        <div key={pj.id} className="flex items-center gap-3 bg-white border border-ghost rounded-xl px-3 py-2.5">
                          <FileText size={15} className="text-red-400 shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{pj.nom_fichier}</p>
                            <p className="text-xs text-mist">{(pj.taille_octets / 1024).toFixed(0)} KB</p>
                          </div>
                          {downloadPJFn && (
                            <button onClick={() => downloadPJFn(pj.id, pj.nom_fichier)}
                              className="p-1.5 rounded-lg hover:bg-ghost text-mist hover:text-brand transition-colors shrink-0">
                              <Download size={14}/>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Données manquantes */}
                {(() => {
                  const m = [
                    !data.telephone_portable && !data.telephone_fixe && 'Téléphone',
                    !data.adresse_fr && 'Adresse',
                    !data.date_naissance && 'Date de naissance',
                    !data.lieu_naiss_fr && 'Lieu de naissance',
                    !data.code_type_bac && 'Type BAC',
                    !data.nom_ar && 'Nom en arabe',
                    !data.email_verified && 'Email non vérifié',
                  ].filter(Boolean)
                  return m.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-[0.68rem] font-black text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Info size={11}/> {m.length} champ{m.length>1?'s':''} manquant{m.length>1?'s':''}
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {m.map(x => (
                          <div key={x} className="flex items-center gap-1.5 text-xs text-amber-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>
                            {x}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                      <CheckCircle size={14} className="text-emerald-600 shrink-0"/>
                      <p className="text-xs font-bold text-emerald-800">Toutes les données essentielles sont renseignées</p>
                    </div>
                  )
                })()}

                {/* Décision (responsable uniquement) */}
                {decideInscriptionFn && activeInsc.statut === 'en_attente' && (
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="h-px bg-ghost"/>
                    <p className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-2">
                      <Shield size={12} className="text-brand"/> Décision
                    </p>
                    {!showReject ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleValider} disabled={deciding}
                          className="flex flex-col items-center gap-2 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-100 transition-all disabled:opacity-50 group">
                          <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                            {deciding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <CheckCircle size={22} className="text-white"/>}
                          </div>
                          <p className="font-black text-emerald-800 text-sm">Valider</p>
                          <p className="text-xs text-emerald-700 text-center leading-tight">Accepter l'inscription</p>
                        </button>
                        <button onClick={() => setSR(true)}
                          className="flex flex-col items-center gap-2 p-4 bg-red-50 border-2 border-red-200 rounded-2xl hover:border-red-400 hover:bg-red-100 transition-all group">
                          <div className="w-11 h-11 bg-red-500 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                            <XCircle size={22} className="text-white"/>
                          </div>
                          <p className="font-black text-red-800 text-sm">Refuser</p>
                          <p className="text-xs text-red-700 text-center leading-tight">Rejeter le dossier</p>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
                        <p className="text-sm font-bold text-ink flex items-center gap-2"><XCircle size={14} className="text-red-500"/>Motif du refus</p>
                        <textarea rows={4}
                          className="border-[1.5px] border-fog rounded-xl px-3.5 py-3 text-sm text-ink resize-none outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                          placeholder="Précisez le motif — ce message sera envoyé à l'étudiant…"
                          value={rejectMsg} onChange={e => setRM(e.target.value)}/>
                        <div className="grid grid-cols-2 gap-2">
                          <Btn variant="ghost" onClick={() => { setSR(false); setRM('') }}>Annuler</Btn>
                          <Btn variant="danger" icon={<XCircle size={13}/>} loading={deciding} onClick={handleRejeter}>Confirmer</Btn>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Affichage décision déjà prise */}
                {decideInscriptionFn && activeInsc.statut === 'validee' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle size={15}/> Dossier déjà validé
                  </div>
                )}
                {decideInscriptionFn && activeInsc.statut === 'rejetee' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-semibold text-red-800 flex items-center gap-2">
                    <XCircle size={15}/> Dossier refusé — l'étudiant peut corriger et resoumettre
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
