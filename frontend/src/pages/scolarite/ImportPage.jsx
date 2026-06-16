/**
 * Import flexible des étudiants — wizard 3 étapes.
 *
 *   Étape 1 — Fichier         : choix fichier (.xlsx/.xls/.csv) + niveau + options
 *   Étape 2 — Mapping         : associer chaque colonne du fichier à un champ cible
 *                                avec auto-détection + modèles réutilisables
 *   Étape 3 — Résultat        : statistiques + erreurs détaillées
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Upload, FileSpreadsheet, FileText, CheckCircle, AlertTriangle, X,
  Layers, RefreshCw, ArrowLeft, ArrowRight, Eye, Wand2,
  Search, Sparkles, ChevronRight, Save, Trash2, BookmarkPlus, FolderOpen,
  Edit3, Copy, Zap, EyeOff, CircleAlert, ListFilter, Hash, Star,
  Asterisk, Database, Link2, Pencil,
} from 'lucide-react'
import clsx from 'clsx'
import { Btn, SectionHead } from '../../components/ui'
import {
  listNiveaux,
  getImportFields,
  previewImport,
  executeImport,
  getResponsableProfile,
  getImportFieldsResp,
  previewImportResp,
  executeImportResp,
} from '../../services/adminApi'

// ── Adaptateur API selon le rôle ──────────────────────────────────
function buildApi(mode) {
  if (mode === 'responsable') {
    return {
      isResponsable: true,
      listNiveaux: () => getResponsableProfile().then(p => p?.niveau ? [p.niveau] : []),
      getImportFields: getImportFieldsResp,
      previewImport: previewImportResp,
      executeImport: ({ file, mapping, update_existing }) =>
        executeImportResp({ file, mapping, update_existing }),
    }
  }
  return {
    isResponsable: false,
    listNiveaux: () => listNiveaux().then(r => r.data),
    getImportFields,
    previewImport,
    executeImport,
  }
}

const STEPS = [
  { id: 1, label: 'Fichier',  icon: <Upload  size={14}/> },
  { id: 2, label: 'Mapping',  icon: <Wand2   size={14}/> },
  { id: 3, label: 'Résultat', icon: <CheckCircle size={14}/> },
]

const TEMPLATES_KEY = 'scolarite.import.mappings.v1'
const loadTemplates = () => {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') }
  catch { return [] }
}
const saveTemplates = (list) => localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list))

const IGNORE = '__ignore__'

export default function ImportPage({ mode = 'scolarite' } = {}) {
  const api = useMemo(() => buildApi(mode), [mode])
  const isResp = api.isResponsable
  const [step, setStep] = useState(1)

  // Étape 1
  const [file, setFile]         = useState(null)
  const [niveaux, setNiveaux]   = useState([])
  const [niveauId, setNiveauId] = useState('')
  const [updateExisting, setUpdateExisting] = useState(true)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  // Étape 2
  const [targets, setTargets]   = useState([])
  const [preview, setPreview]   = useState(null)   // { columns, sample_rows, total_rows, suggested_mapping }
  const [mapping, setMapping]   = useState({})     // { file_column: target_key | IGNORE }
  const [autoDetected, setAutoDetected] = useState(new Set())
  const [previewing, setPreviewing] = useState(false)
  const [search, setSearch]     = useState('')

  // Modèles de mapping
  const [templates, setTemplates] = useState(loadTemplates)
  const [activeTplId, setActiveTplId] = useState(null)
  const [dialog, setDialog] = useState(null)

  // Étape 3
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState(null)

  // ── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.listNiveaux(),
      api.getImportFields(),
    ]).then(([nv, cat]) => {
      setNiveaux(nv || [])
      setTargets(cat?.fields || [])
      if (nv?.length === 1) setNiveauId(String(nv[0].id))
    }).catch(() => toast.error('Erreur de chargement'))
  }, [api])

  // ── Étape 1 → 2 : preview ───────────────────────────────────────
  function selectFile(f) {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Fichier .xlsx, .xls ou .csv requis')
      return
    }
    setFile(f)
    setResult(null)
  }

  async function gotoMapping() {
    if (!file)     { toast.error('Sélectionnez un fichier'); return }
    if (!niveauId) { toast.error('Sélectionnez le niveau'); return }
    setPreviewing(true)
    try {
      const data = await api.previewImport(file)
      setPreview(data)
      // Initialiser le mapping avec les suggestions
      const m = {}
      const detected = new Set()
      for (const col of data.columns) {
        if (data.suggested_mapping[col]) {
          m[col] = data.suggested_mapping[col]
          detected.add(col)
        } else {
          m[col] = IGNORE
        }
      }
      setMapping(m)
      setAutoDetected(detected)
      setActiveTplId(null)
      setStep(2)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de l\'analyse du fichier')
    } finally {
      setPreviewing(false)
    }
  }

  // ── Étape 2 → 3 : import ────────────────────────────────────────
  async function runImport() {
    // Construire le mapping final (sans IGNORE)
    const cleanMapping = {}
    for (const [src, dst] of Object.entries(mapping)) {
      if (dst && dst !== IGNORE) cleanMapping[src] = dst
    }
    if (!Object.keys(cleanMapping).length) {
      toast.error('Mappez au moins une colonne')
      return
    }
    // Vérif champs requis
    const mappedTargets = new Set(Object.values(cleanMapping))
    const missingRequired = targets
      .filter(t => t.required && !mappedTargets.has(t.key))
      .map(t => t.label)
    if (missingRequired.length) {
      toast.error(`Champs obligatoires non mappés : ${missingRequired.join(', ')}`)
      return
    }

    setImporting(true)
    try {
      const res = await api.executeImport({
        file,
        mapping: cleanMapping,
        niveau_id: parseInt(niveauId),
        update_existing: updateExisting,
      })
      setResult(res)
      setStep(3)
      toast.success(`Import terminé — ${res.imported} créé(s), ${res.updated} mis à jour`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de l\'import')
    } finally {
      setImporting(false)
    }
  }

  // ── Helpers mapping ─────────────────────────────────────────────
  const targetByKey = useMemo(
    () => Object.fromEntries(targets.map(t => [t.key, t])),
    [targets],
  )
  const groupedTargets = useMemo(() => {
    const g = {}
    for (const t of targets) (g[t.group] ??= []).push(t)
    return g
  }, [targets])

  const usedTargets = useMemo(() => {
    const map = new Map()
    for (const [src, dst] of Object.entries(mapping)) {
      if (dst && dst !== IGNORE) map.set(dst, src)
    }
    return map
  }, [mapping])

  const requiredMissing = useMemo(
    () => targets.filter(t => t.required && !usedTargets.has(t.key)),
    [targets, usedTargets],
  )

  const filteredColumns = useMemo(() => {
    if (!preview) return []
    const q = search.trim().toLowerCase()
    if (!q) return preview.columns
    return preview.columns.filter(c => c.toLowerCase().includes(q))
  }, [preview, search])

  function setTarget(col, value) {
    setMapping(prev => ({ ...prev, [col]: value || IGNORE }))
    setAutoDetected(prev => {
      const next = new Set(prev); next.delete(col); return next
    })
    setActiveTplId(null)
  }

  function autoDetectAll() {
    if (!preview) return
    const m = {}; const detected = new Set()
    for (const col of preview.columns) {
      if (preview.suggested_mapping[col]) {
        m[col] = preview.suggested_mapping[col]
        detected.add(col)
      } else {
        m[col] = IGNORE
      }
    }
    setMapping(m); setAutoDetected(detected); setActiveTplId(null)
    toast.success('Auto-détection appliquée')
  }

  function clearMapping() {
    if (!preview) return
    const m = {}
    for (const col of preview.columns) m[col] = IGNORE
    setMapping(m); setAutoDetected(new Set()); setActiveTplId(null)
  }

  // ── Modèles de mapping ──────────────────────────────────────────
  function persistTemplates(list) { setTemplates(list); saveTemplates(list) }

  function applyTemplate(t) {
    if (!preview) return
    setActiveTplId(t.id)
    const m = {}
    for (const col of preview.columns) {
      m[col] = t.mapping[col] || IGNORE
    }
    setMapping(m); setAutoDetected(new Set())
    toast.success(`Modèle « ${t.name} » appliqué`)
  }

  function saveAsTemplate() {
    const cleanMapping = Object.fromEntries(
      Object.entries(mapping).filter(([, v]) => v && v !== IGNORE)
    )
    if (!Object.keys(cleanMapping).length) {
      toast.error('Aucune colonne mappée à enregistrer'); return
    }
    setDialog({
      type: 'prompt',
      title: 'Nouveau modèle de mapping',
      message: 'Enregistrez ce mapping pour le réutiliser sur des fichiers similaires.',
      defaultValue: `Mapping ${templates.length + 1}`,
      placeholder: 'ex. Format SALIMA Ministère',
      icon: <BookmarkPlus size={18}/>,
      confirmLabel: 'Enregistrer',
      onConfirm: (name) => {
        const t = {
          id: `imp_${Date.now()}`,
          name: name.trim(),
          mapping: cleanMapping,
          createdAt: new Date().toISOString(),
        }
        persistTemplates([...templates, t])
        setActiveTplId(t.id)
        toast.success('Modèle enregistré')
      },
    })
  }

  function updateActiveTemplate() {
    if (!activeTplId) return
    const cleanMapping = Object.fromEntries(
      Object.entries(mapping).filter(([, v]) => v && v !== IGNORE)
    )
    persistTemplates(templates.map(t =>
      t.id === activeTplId
        ? { ...t, mapping: cleanMapping, updatedAt: new Date().toISOString() }
        : t
    ))
    toast.success('Modèle mis à jour')
  }

  function renameTemplate(t) {
    setDialog({
      type: 'prompt',
      title: 'Renommer le modèle',
      defaultValue: t.name,
      icon: <Edit3 size={18}/>,
      confirmLabel: 'Renommer',
      onConfirm: (name) => {
        const trimmed = name.trim()
        if (!trimmed || trimmed === t.name) return
        persistTemplates(templates.map(x => x.id === t.id ? { ...x, name: trimmed } : x))
      },
    })
  }

  function duplicateTemplate(t) {
    persistTemplates([...templates, {
      ...t, id: `imp_${Date.now()}`, name: `${t.name} (copie)`,
      createdAt: new Date().toISOString(),
    }])
    toast.success('Modèle dupliqué')
  }

  function deleteTemplate(t) {
    setDialog({
      type: 'confirm',
      title: 'Supprimer ce modèle ?',
      message: <>Le modèle <strong>« {t.name} »</strong> sera supprimé définitivement.</>,
      icon: <AlertTriangle size={18}/>,
      danger: true,
      confirmLabel: 'Supprimer',
      onConfirm: () => {
        persistTemplates(templates.filter(x => x.id !== t.id))
        if (activeTplId === t.id) setActiveTplId(null)
      },
    })
  }

  // ── Reset wizard ────────────────────────────────────────────────
  function resetWizard() {
    setFile(null); setPreview(null); setMapping({})
    setResult(null); setStep(1); setActiveTplId(null)
  }

  // ══════════════════════════════════════════════════════════════
  //  Rendu
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="pb-10 space-y-6">
      <SectionHead
        title={isResp ? 'Import — étudiants de mon niveau' : 'Import des étudiants'}
        sub={isResp
          ? 'Tous les étudiants importés seront automatiquement affectés à votre niveau.'
          : 'Importez depuis n\'importe quel fichier Excel ou CSV en mappant les colonnes.'}
      />

      {/* Stepper */}
      <Stepper step={step} />

      {step === 1 && (
        <Step1
          file={file} dragging={dragging} fileRef={fileRef}
          niveaux={niveaux} niveauId={niveauId} updateExisting={updateExisting}
          previewing={previewing} isResp={isResp}
          onFile={selectFile} onDragging={setDragging}
          onNiveau={setNiveauId} onUpdateExisting={setUpdateExisting}
          onNext={gotoMapping}
        />
      )}

      {step === 2 && preview && (
        <Step2
          file={file} preview={preview} mapping={mapping}
          targets={targets} groupedTargets={groupedTargets}
          targetByKey={targetByKey} usedTargets={usedTargets}
          autoDetected={autoDetected}
          requiredMissing={requiredMissing}
          search={search} setSearch={setSearch}
          filteredColumns={filteredColumns}
          templates={templates} activeTplId={activeTplId}
          importing={importing}
          onTarget={setTarget} onAutoDetect={autoDetectAll} onClearMapping={clearMapping}
          onApplyTpl={applyTemplate} onSaveAsTpl={saveAsTemplate}
          onUpdateTpl={updateActiveTemplate} onRenameTpl={renameTemplate}
          onDupTpl={duplicateTemplate} onDelTpl={deleteTemplate}
          onBack={() => setStep(1)} onImport={runImport}
        />
      )}

      {step === 3 && result && (
        <Step3 result={result} onReset={resetWizard}/>
      )}

      {dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//  STEPPER
// ══════════════════════════════════════════════════════════════════
function Stepper({ step }) {
  return (
    <div className="bg-white rounded-2xl border border-ghost shadow-sm p-4">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = step > s.id
          const active = step === s.id
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-initial">
              <div className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl flex-1 transition',
                active && 'bg-brand/10',
                done && 'opacity-90',
              )}>
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition',
                  done   && 'bg-emerald-500 text-white',
                  active && 'bg-brand text-white shadow-sm',
                  !done && !active && 'bg-ghost text-muted',
                )}>
                  {done ? <CheckCircle size={16}/> : s.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Étape {s.id}</div>
                  <div className={clsx(
                    'text-sm font-bold truncate',
                    active ? 'text-brand' : done ? 'text-night' : 'text-muted',
                  )}>{s.label}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight size={16} className={clsx('shrink-0 mx-1', done ? 'text-emerald-400' : 'text-ghost')}/>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//  ÉTAPE 1 — Fichier + niveau + options
// ══════════════════════════════════════════════════════════════════
function Step1({
  file, dragging, fileRef, niveaux, niveauId, updateExisting, previewing, isResp,
  onFile, onDragging, onNiveau, onUpdateExisting, onNext,
}) {
  const myNiveau = isResp ? niveaux[0] : null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Drop zone */}
      <div className="lg:col-span-2 space-y-5">
        <Card icon={<Upload size={16}/>} title="Fichier à importer" subtitle="Excel (.xlsx / .xls) ou CSV">
          <div
            onDragOver={e => { e.preventDefault(); onDragging(true) }}
            onDragLeave={() => onDragging(false)}
            onDrop={e => { e.preventDefault(); onDragging(false); onFile(e.dataTransfer.files[0]) }}
            onClick={() => !file && fileRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-2xl py-12 px-6 flex flex-col items-center gap-3 text-center transition cursor-pointer',
              dragging && 'border-brand bg-brand/5 scale-[1.005]',
              !dragging && file && 'border-emerald-400 bg-emerald-50/50 cursor-default',
              !dragging && !file && 'border-ghost bg-ghost/10 hover:border-brand/50 hover:bg-brand/5',
            )}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => onFile(e.target.files[0])}/>
            {file ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  {file.name.toLowerCase().endsWith('.csv')
                    ? <FileText size={30} className="text-emerald-600"/>
                    : <FileSpreadsheet size={30} className="text-emerald-600"/>}
                </div>
                <div>
                  <p className="font-bold text-night text-base">{file.name}</p>
                  <p className="text-xs text-muted mt-0.5">{(file.size / 1024).toFixed(1)} Ko</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onFile(null) }}
                  className="text-xs font-bold text-muted hover:text-danger flex items-center gap-1 mt-1">
                  <X size={12}/> Changer le fichier
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center">
                  <Upload size={28} className="text-brand"/>
                </div>
                <div>
                  <p className="font-bold text-night text-base">Glissez votre fichier ici</p>
                  <p className="text-sm text-muted mt-1">ou cliquez pour parcourir — .xlsx, .xls, .csv</p>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card icon={<Sparkles size={16}/>} title="Options">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-ghost hover:border-brand/40 cursor-pointer transition">
            <input
              type="checkbox" checked={updateExisting}
              onChange={e => onUpdateExisting(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-brand"/>
            <div>
              <div className="text-sm font-semibold text-night">Mettre à jour les étudiants existants</div>
              <div className="text-[11px] text-muted leading-snug mt-0.5">
                Les étudiants identifiés par leur Matricule/CIN seront mis à jour avec les nouvelles données.
                Sinon, ils seront ignorés.
              </div>
            </div>
          </label>
        </Card>
      </div>

      {/* Niveau */}
      <div className="lg:col-span-1">
        <Card
          icon={<Layers size={16}/>}
          title="Niveau d'études"
          subtitle={isResp ? 'Verrouillé sur votre niveau' : 'Assigné à tous les étudiants importés'}>
          {!niveaux.length ? (
            <p className="text-sm text-muted italic text-center py-6">Chargement…</p>
          ) : isResp && myNiveau ? (
            <div className="rounded-xl border-2 border-brand bg-brand/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0">
                <Layers size={18}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand/80">Niveau verrouillé</p>
                <p className="text-sm font-bold text-night capitalize truncate">{myNiveau.libelle}</p>
                {myNiveau.code && <p className="text-[10px] font-mono text-muted">{myNiveau.code}</p>}
              </div>
              <CheckCircle size={16} className="text-brand shrink-0"/>
            </div>
          ) : (
            <div className="space-y-2">
              {niveaux.map(n => (
                <label key={n.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition',
                    niveauId === String(n.id)
                      ? 'border-brand bg-brand/5 shadow-sm'
                      : 'border-ghost bg-white hover:border-brand/40',
                  )}>
                  <input type="radio" name="niveau" value={n.id}
                    checked={niveauId === String(n.id)}
                    onChange={() => onNiveau(String(n.id))}
                    className="accent-brand w-4 h-4 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-bold capitalize',
                      niveauId === String(n.id) ? 'text-brand' : 'text-night')}>
                      {n.libelle}
                    </p>
                    {n.code && <p className="text-[10px] font-mono text-muted">{n.code}</p>}
                  </div>
                  {niveauId === String(n.id) &&
                    <CheckCircle size={15} className="text-brand shrink-0"/>}
                </label>
              ))}
            </div>
          )}
        </Card>

        <div className="mt-5">
          <Btn
            size="lg" className="w-full justify-center"
            icon={previewing ? <RefreshCw size={16} className="animate-spin"/> : <ArrowRight size={16}/>}
            disabled={!file || !niveauId || previewing}
            onClick={onNext}>
            {previewing ? 'Analyse du fichier…' : 'Analyser et mapper'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//  ÉTAPE 2 — Mapping (refonte pro)
// ══════════════════════════════════════════════════════════════════
const STATUS_FILTERS = [
  { id: 'all',      label: 'Toutes',         tone: 'slate'   },
  { id: 'auto',     label: 'Auto-détectées', tone: 'emerald' },
  { id: 'manual',   label: 'Mappage manuel', tone: 'brand'   },
  { id: 'unmapped', label: 'À mapper',       tone: 'amber'   },
  { id: 'ignored',  label: 'Ignorées',       tone: 'muted'   },
  { id: 'conflict', label: 'Conflits',       tone: 'danger'  },
]

function rowStatus({ col, selected, isAuto, usedTargets }) {
  if (selected === '__ignore__' || !selected) return 'ignored'
  const owner = usedTargets.get(selected)
  if (owner && owner !== col) return 'conflict'
  return isAuto ? 'auto' : 'manual'
}

function Step2({
  file, preview, mapping, targets, groupedTargets, targetByKey, usedTargets,
  autoDetected, requiredMissing,
  search, setSearch, filteredColumns,
  templates, activeTplId, importing,
  onTarget, onAutoDetect, onClearMapping,
  onApplyTpl, onSaveAsTpl, onUpdateTpl, onRenameTpl, onDupTpl, onDelTpl,
  onBack, onImport,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [hoveredCol, setHoveredCol] = useState(null)

  // ── Calculs de statut & compteurs ────────────────────────────────
  const statusByCol = useMemo(() => {
    const m = {}
    for (const col of preview.columns) {
      m[col] = rowStatus({ col, selected: mapping[col], isAuto: autoDetected.has(col), usedTargets })
    }
    return m
  }, [preview.columns, mapping, autoDetected, usedTargets])

  const counts = useMemo(() => {
    const c = { all: preview.columns.length, auto: 0, manual: 0, ignored: 0, conflict: 0, unmapped: 0 }
    for (const col of preview.columns) {
      const s = statusByCol[col]
      c[s] = (c[s] || 0) + 1
    }
    c.unmapped = c.ignored
    return c
  }, [preview.columns, statusByCol])

  const mappedCount = counts.auto + counts.manual
  const ignoredCount = counts.ignored
  const conflictCount = counts.conflict

  // ── Filtrage par statut + recherche ──────────────────────────────
  const visibleColumns = useMemo(() => {
    return filteredColumns.filter(col => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'unmapped') return statusByCol[col] === 'ignored'
      return statusByCol[col] === statusFilter
    })
  }, [filteredColumns, statusFilter, statusByCol])

  // ── Statistiques de remplissage par colonne ──────────────────────
  const fillStats = useMemo(() => {
    const stats = {}
    for (const col of preview.columns) {
      const filled = preview.sample_rows.filter(r => {
        const v = r[col]
        return v !== null && v !== undefined && String(v).trim() !== ''
      }).length
      stats[col] = { filled, total: preview.sample_rows.length }
    }
    return stats
  }, [preview])

  return (
    <div className="space-y-6">
      {/* ─── Bandeau récap fichier ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden">
        <div className="p-5 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            {file.name.toLowerCase().endsWith('.csv') ? <FileText size={22}/> : <FileSpreadsheet size={22}/>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-night truncate">{file.name}</p>
            <div className="flex items-center gap-2 text-[11px] mt-1 flex-wrap">
              <Tag tone="slate"><Database size={10}/>&nbsp;{preview.columns.length} colonnes</Tag>
              <Tag tone="slate"><Hash size={10}/>&nbsp;{preview.total_rows} lignes</Tag>
              <Tag tone="emerald"><Zap size={10}/>&nbsp;{counts.auto} auto-détectées</Tag>
              {counts.manual > 0  && <Tag tone="brand"><Pencil size={10}/>&nbsp;{counts.manual} manuelles</Tag>}
              {conflictCount > 0  && <Tag tone="danger"><CircleAlert size={10}/>&nbsp;{conflictCount} conflit{conflictCount > 1 ? 's' : ''}</Tag>}
              {ignoredCount > 0   && <Tag tone="muted"><EyeOff size={10}/>&nbsp;{ignoredCount} ignorées</Tag>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="secondary" icon={<Wand2 size={13}/>} onClick={onAutoDetect}>
              Auto-détecter
            </Btn>
            <Btn size="sm" variant="secondary" icon={<X size={13}/>} onClick={onClearMapping}>
              Vider
            </Btn>
          </div>
        </div>

        {/* Barre de progression de mapping */}
        <div className="h-1.5 bg-ghost relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-emerald-500 transition-all" style={{ width: `${(counts.auto / counts.all) * 100}%` }}/>
          <div className="absolute inset-y-0 bg-brand transition-all"
               style={{ left: `${(counts.auto / counts.all) * 100}%`, width: `${(counts.manual / counts.all) * 100}%` }}/>
          {conflictCount > 0 && (
            <div className="absolute inset-y-0 bg-danger transition-all"
                 style={{ left: `${((counts.auto + counts.manual) / counts.all) * 100}%`, width: `${(conflictCount / counts.all) * 100}%` }}/>
          )}
        </div>
      </div>

      {/* ─── Champs obligatoires (checklist) ───────────────────── */}
      <RequiredChecklist
        targets={targets}
        usedTargets={usedTargets}
        targetByKey={targetByKey}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ─── Colonne principale : mapping + aperçu ──────────── */}
        <div className="xl:col-span-2 space-y-5">
          <Card
            icon={<Link2 size={16}/>}
            title="Vérifier les correspondances"
            subtitle="Chaque colonne détectée → champ étudiant cible"
            right={
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"/>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une colonne…"
                  className="pl-7 pr-3 py-1.5 rounded-lg border border-ghost text-xs w-52 focus:border-brand outline-none"/>
              </div>
            }>
            {/* Filtres par statut */}
            <div className="flex items-center gap-2 mb-4 flex-wrap pb-3 border-b border-ghost">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5 mr-1">
                <ListFilter size={11}/> Filtrer
              </span>
              {STATUS_FILTERS.map(f => {
                const n = counts[f.id] || 0
                if (f.id !== 'all' && n === 0) return null
                return (
                  <FilterChip
                    key={f.id}
                    active={statusFilter === f.id}
                    tone={f.tone}
                    onClick={() => setStatusFilter(f.id)}>
                    {f.label} <span className="font-mono opacity-70">({n})</span>
                  </FilterChip>
                )
              })}
            </div>

            <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1 -mr-1">
              {visibleColumns.length === 0 ? (
                <div className="text-center text-xs text-muted py-12 italic flex flex-col items-center gap-2">
                  <Search size={20} className="opacity-40"/>
                  Aucune colonne ne correspond à ce filtre.
                </div>
              ) : (
                visibleColumns.map((col) => {
                  const idx = preview.columns.indexOf(col)
                  return (
                    <MappingRow
                      key={col}
                      col={col}
                      index={idx}
                      status={statusByCol[col]}
                      selected={mapping[col]}
                      sample={preview.sample_rows.map(r => r[col])}
                      fillStat={fillStats[col]}
                      groupedTargets={groupedTargets}
                      targetByKey={targetByKey}
                      usedTargets={usedTargets}
                      isHovered={hoveredCol === col}
                      onHover={() => setHoveredCol(col)}
                      onLeave={() => setHoveredCol(null)}
                      onChange={val => onTarget(col, val)}
                    />
                  )
                })
              )}
            </div>
          </Card>

          {/* Aperçu des données */}
          <Card icon={<Eye size={16}/>} title="Aperçu des données" subtitle={`Premières ${preview.sample_rows.length} lignes du fichier`}>
            <div className="overflow-x-auto rounded-xl border border-ghost">
              <table className="w-full text-xs">
                <thead className="bg-ghost/50 border-b border-ghost sticky top-0">
                  <tr>
                    <th className="px-2 py-2.5 text-left font-bold text-muted w-10">#</th>
                    {preview.columns.map(c => {
                      const s = statusByCol[c]
                      const tone = s === 'auto' ? 'border-b-emerald-400'
                        : s === 'manual' ? 'border-b-brand'
                        : s === 'conflict' ? 'border-b-danger'
                        : 'border-b-ghost'
                      return (
                        <th key={c}
                          onMouseEnter={() => setHoveredCol(c)}
                          onMouseLeave={() => setHoveredCol(null)}
                          className={clsx(
                            'px-3 py-2 text-left font-bold text-night whitespace-nowrap border-b-2 transition',
                            tone,
                            hoveredCol === c && 'bg-brand/5'
                          )}>
                          <div className="truncate max-w-[140px]">{c}</div>
                          {mapping[c] && mapping[c] !== '__ignore__' && (
                            <div className="text-[9px] font-mono text-brand mt-0.5 normal-case">
                              → {targetByKey[mapping[c]]?.label}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.map((row, i) => (
                    <tr key={i} className="border-b border-ghost last:border-0">
                      <td className="px-2 py-1.5 text-muted font-mono">{i + 1}</td>
                      {preview.columns.map(c => (
                        <td key={c}
                          className={clsx(
                            'px-3 py-1.5 text-night whitespace-nowrap max-w-[200px] truncate transition',
                            hoveredCol === c && 'bg-brand/5'
                          )}>
                          {row[c] || <span className="text-muted/60 italic">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ─── Sidebar : modèles + actions ──────────────────── */}
        <aside className="space-y-5">
          <Card
            icon={<FolderOpen size={16}/>}
            title="Mes modèles"
            subtitle={templates.length ? `${templates.length} modèle${templates.length > 1 ? 's' : ''}` : 'Aucun modèle'}
            right={
              <button onClick={onSaveAsTpl}
                className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline">
                <BookmarkPlus size={12}/> Enregistrer
              </button>
            }>
            {!templates.length ? (
              <p className="text-xs text-muted leading-relaxed text-center py-4">
                Configurez votre mapping puis cliquez sur <strong className="text-brand">Enregistrer</strong> pour le réutiliser.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 -mr-1">
                {templates.map(t => {
                  const active = activeTplId === t.id
                  return (
                    <div key={t.id}
                      onClick={() => onApplyTpl(t)}
                      className={clsx(
                        'group rounded-xl border-2 p-3 cursor-pointer transition relative',
                        active
                          ? 'border-brand bg-brand/5 shadow-sm'
                          : 'border-ghost bg-white hover:border-brand/40',
                      )}>
                      <div className="flex items-center gap-2">
                        <div className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          active ? 'bg-brand text-white' : 'bg-brand/10 text-brand',
                        )}>
                          <Layers size={14}/>
                        </div>
                        <div className="flex-1 min-w-0 pr-10">
                          <p className="text-xs font-bold text-night truncate">{t.name}</p>
                          <p className="text-[10px] font-mono text-muted">
                            {Object.keys(t.mapping).length} mappings
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
                        onClick={e => e.stopPropagation()}>
                        {active && <TplIconBtn icon={<Save size={11}/>}   title="Mettre à jour" onClick={onUpdateTpl}/>}
                        <TplIconBtn icon={<Edit3 size={11}/>}  title="Renommer"  onClick={() => onRenameTpl(t)}/>
                        <TplIconBtn icon={<Copy size={11}/>}   title="Dupliquer" onClick={() => onDupTpl(t)}/>
                        <TplIconBtn icon={<Trash2 size={11}/>} title="Supprimer" danger onClick={() => onDelTpl(t)}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card icon={<CheckCircle size={16}/>} title="Récapitulatif">
            <div className="space-y-2 text-xs">
              <RecapRow label="Colonnes du fichier" value={preview.columns.length}/>
              <RecapRow label="Lignes à importer"   value={preview.total_rows}/>
              <RecapRow label="Colonnes mappées"    value={mappedCount} tone="brand"/>
              <RecapRow label="Colonnes ignorées"   value={ignoredCount} tone="muted"/>
              {requiredMissing.length > 0 && (
                <RecapRow label="Champs requis manquants" value={requiredMissing.length} tone="amber"/>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <Btn
              size="lg" className="w-full justify-center"
              icon={importing ? <RefreshCw size={16} className="animate-spin"/> : <Upload size={16}/>}
              disabled={importing || !mappedCount || requiredMissing.length > 0}
              onClick={onImport}>
              {importing ? 'Import en cours…' : 'Lancer l\'import'}
            </Btn>
            <Btn variant="secondary" icon={<ArrowLeft size={14}/>} onClick={onBack}>
              Retour à l'étape précédente
            </Btn>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Ligne de mapping (refonte pro : source | connecteur | cible) ──
const STATUS_META = {
  auto:     { color: 'emerald', icon: <Zap size={11}/>,         label: 'Auto-détectée',
              ring: 'border-emerald-300 bg-emerald-50/30',     strip: 'bg-emerald-500',
              dot:  'bg-emerald-500',                          text: 'text-emerald-700' },
  manual:   { color: 'brand',   icon: <Pencil size={11}/>,      label: 'Mappage manuel',
              ring: 'border-brand/40 bg-brand/5',              strip: 'bg-brand',
              dot:  'bg-brand',                                text: 'text-brand' },
  ignored:  { color: 'muted',   icon: <EyeOff size={11}/>,      label: 'Ignorée',
              ring: 'border-ghost bg-ghost/20',                strip: 'bg-ghost',
              dot:  'bg-muted/50',                             text: 'text-muted' },
  conflict: { color: 'danger',  icon: <CircleAlert size={11}/>, label: 'Conflit',
              ring: 'border-danger/40 bg-danger/5',            strip: 'bg-danger',
              dot:  'bg-danger',                               text: 'text-danger' },
}

function MappingRow({
  col, index, status, selected, sample, fillStat,
  groupedTargets, targetByKey, usedTargets,
  isHovered, onHover, onLeave, onChange,
}) {
  const meta = STATUS_META[status]
  const target = targetByKey[selected]
  const conflictOwner = status === 'conflict' ? usedTargets.get(selected) : null

  const distinctSamples = useMemo(() => {
    const set = new Set()
    for (const v of sample) {
      if (v === null || v === undefined) continue
      const s = String(v).trim()
      if (!s) continue
      set.add(s)
      if (set.size >= 3) break
    }
    return [...set]
  }, [sample])

  return (
    <article
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={clsx(
        'relative rounded-xl border-2 transition overflow-hidden',
        meta.ring,
        isHovered && 'shadow-md ring-2 ring-brand/10',
      )}>
      {/* Bande de statut à gauche */}
      <div className={clsx('absolute left-0 inset-y-0 w-1', meta.strip)}/>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-2 items-stretch p-3 pl-4">

        {/* ─── ZONE SOURCE (colonne du fichier) ─── */}
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-night/5 text-[10px] font-extrabold font-mono text-muted shrink-0">
              #{index + 1}
            </span>
            <h4 className="text-sm font-extrabold text-night truncate" title={col}>
              {col}
            </h4>
            <span className={clsx(
              'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider',
              status === 'auto'     && 'bg-emerald-100 text-emerald-700',
              status === 'manual'   && 'bg-brand/15 text-brand',
              status === 'ignored'  && 'bg-ghost text-muted',
              status === 'conflict' && 'bg-danger/15 text-danger',
            )}>
              {meta.icon} {meta.label}
            </span>
          </div>

          {/* Sample values en pills */}
          <div className="flex items-center gap-1.5 flex-wrap pl-8">
            {distinctSamples.length > 0 ? distinctSamples.map((v, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-ghost text-[11px] font-mono text-night/80 max-w-[180px] truncate">
                {v}
              </span>
            )) : (
              <span className="text-[10px] italic text-muted">Aucune valeur dans l'échantillon</span>
            )}
            {fillStat && (
              <span className={clsx(
                'inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono',
                fillStat.filled === fillStat.total
                  ? 'bg-emerald-50 text-emerald-700'
                  : fillStat.filled === 0
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-slate-100 text-slate-600',
              )}>
                {fillStat.filled}/{fillStat.total} renseignés
              </span>
            )}
          </div>
        </div>

        {/* ─── CONNECTEUR ─── */}
        <div className="flex md:flex-col items-center justify-center md:px-2 gap-1 shrink-0">
          <span className={clsx('w-2 h-2 rounded-full', meta.dot)}/>
          <div className={clsx(
            'h-px md:h-8 w-8 md:w-px',
            status === 'ignored' ? 'bg-ghost' : 'bg-current opacity-30',
            meta.text,
          )}/>
          <ArrowRight size={14} className={clsx('shrink-0', meta.text)}/>
        </div>

        {/* ─── ZONE CIBLE (champ étudiant) ─── */}
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {target ? (
              <>
                <Database size={12} className={clsx('shrink-0', meta.text)}/>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted leading-none">
                    {target.group}
                  </p>
                  <p className={clsx(
                    'text-sm font-bold truncate flex items-center gap-1.5 mt-0.5',
                    status === 'conflict' ? 'text-danger' : 'text-night',
                  )}>
                    {target.label}
                    {target.required && (
                      <Asterisk size={11} className="text-danger shrink-0" title="Champ obligatoire"/>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <EyeOff size={12} className="text-muted shrink-0"/>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted leading-none">
                    Non importée
                  </p>
                  <p className="text-sm font-semibold text-muted italic mt-0.5">
                    Cette colonne sera ignorée
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Dropdown de sélection */}
          <div className="flex items-center gap-1.5">
            <select
              value={selected || '__ignore__'}
              onChange={e => onChange(e.target.value)}
              className={clsx(
                'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-white outline-none transition cursor-pointer',
                status === 'ignored'  && 'border-ghost text-muted hover:border-brand/40',
                status === 'auto'     && 'border-emerald-300 text-emerald-800 focus:ring-2 focus:ring-emerald-200',
                status === 'manual'   && 'border-brand/40 text-brand focus:ring-2 focus:ring-brand/20',
                status === 'conflict' && 'border-danger/40 text-danger focus:ring-2 focus:ring-danger/20',
              )}>
              <option value="__ignore__">— Ignorer cette colonne —</option>
              {Object.entries(groupedTargets).map(([group, fields]) => (
                <optgroup key={group} label={group}>
                  {fields.map(t => (
                    <option key={t.key} value={t.key}>
                      {t.label}{t.required ? ' *' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selected !== '__ignore__' && (
              <button
                onClick={() => onChange('__ignore__')}
                title="Retirer ce mapping"
                className="w-7 h-7 rounded-lg border border-ghost text-muted hover:bg-danger hover:text-white hover:border-danger flex items-center justify-center shrink-0 transition">
                <X size={13}/>
              </button>
            )}
          </div>

          {conflictOwner && (
            <div className="flex items-start gap-1.5 px-2 py-1 rounded-md bg-danger/10 text-[10px] text-danger font-semibold">
              <CircleAlert size={11} className="shrink-0 mt-px"/>
              <span>Champ déjà mappé sur la colonne <strong>« {conflictOwner} »</strong>. Choisissez une autre cible ou retirez l'ancienne.</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Checklist des champs obligatoires ─────────────────────────────
function RequiredChecklist({ targets, usedTargets, targetByKey }) {
  const required = targets.filter(t => t.required)
  if (!required.length) return null
  const okCount = required.filter(t => usedTargets.has(t.key)).length
  const allOk = okCount === required.length

  return (
    <div className={clsx(
      'rounded-2xl border-2 overflow-hidden transition',
      allOk ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/60',
    )}>
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-ghost/50">
        <div className="flex items-center gap-2.5">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            allOk ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
          )}>
            {allOk ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
          </div>
          <div>
            <h3 className={clsx('text-sm font-bold', allOk ? 'text-emerald-900' : 'text-amber-900')}>
              Champs obligatoires {allOk ? '— tous mappés' : `— ${okCount}/${required.length} mappés`}
            </h3>
            <p className={clsx('text-[11px]', allOk ? 'text-emerald-700' : 'text-amber-700')}>
              {allOk
                ? 'Vous pouvez lancer l\'import dès que tout vous semble correct.'
                : 'Mappez ces champs pour pouvoir lancer l\'import.'}
            </p>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4">
        {required.map(t => {
          const src = usedTargets.get(t.key)
          return (
            <div key={t.key} className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 transition',
              src ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-white',
            )}>
              <div className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                src ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
              )}>
                {src ? <CheckCircle size={14}/> : <CircleAlert size={14}/>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-night truncate">{t.label}</p>
                {src ? (
                  <p className="text-[10px] font-mono text-emerald-700 truncate">
                    ← <span className="font-bold">{src}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-700 italic">non mappé</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Chip de filtre statut ────────────────────────────────────────
function FilterChip({ active, tone, onClick, children }) {
  const tones = {
    slate:   { active: 'bg-slate-700 text-white border-slate-700',   idle: 'border-slate-200 text-slate-700 hover:border-slate-300' },
    emerald: { active: 'bg-emerald-500 text-white border-emerald-500', idle: 'border-emerald-200 text-emerald-700 hover:border-emerald-300' },
    brand:   { active: 'bg-brand text-white border-brand',           idle: 'border-brand/30 text-brand hover:border-brand/50' },
    amber:   { active: 'bg-amber-500 text-white border-amber-500',   idle: 'border-amber-200 text-amber-700 hover:border-amber-300' },
    muted:   { active: 'bg-muted text-white border-muted',           idle: 'border-ghost text-muted hover:border-muted/40' },
    danger:  { active: 'bg-danger text-white border-danger',         idle: 'border-danger/30 text-danger hover:border-danger/50' },
  }
  const t = tones[tone] || tones.slate
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[11px] font-bold transition',
        active ? `${t.active} shadow-sm` : `bg-white ${t.idle}`,
      )}>
      {children}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════
//  ÉTAPE 3 — Résultat
// ══════════════════════════════════════════════════════════════════
function Step3({ result, onReset }) {
  const successRate = result.total_rows > 0
    ? Math.round(((result.imported + result.updated) / result.total_rows) * 100)
    : 0
  return (
    <Card icon={<CheckCircle size={16}/>} title="Résultat de l'import" subtitle={`Taux de réussite : ${successRate}%`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total',      v: result.total_rows, tone: 'slate'   },
          { l: 'Créés',      v: result.imported,   tone: 'emerald' },
          { l: 'Mis à jour', v: result.updated,    tone: 'brand'   },
          { l: 'Ignorés',    v: result.skipped,    tone: 'amber'   },
        ].map(s => <StatCard key={s.l} {...s}/>)}
      </div>

      {result.total_rows > 0 && (
        <div className="h-2 bg-ghost rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-gradient-to-r from-brand to-emerald-500 rounded-full transition-all"
            style={{ width: `${successRate}%` }}/>
        </div>
      )}

      {result.errors?.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13}/>
            {result.errors.length} avertissement{result.errors.length > 1 ? 's' : ''}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 max-h-48 overflow-y-auto">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-amber-900 py-0.5 font-mono">{e}</p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <Btn icon={<RefreshCw size={14}/>} onClick={onReset}>Faire un nouvel import</Btn>
      </div>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════════
//  Sous-composants utilitaires
// ══════════════════════════════════════════════════════════════════
function Card({ icon, title, subtitle, right, children, className }) {
  return (
    <section className={clsx('rounded-2xl border border-ghost bg-white shadow-sm overflow-hidden', className)}>
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-ghost bg-gradient-to-b from-ghost/40 to-ghost/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-night truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Tag({ children, tone = 'slate' }) {
  const tones = {
    slate:   'bg-slate-100 text-slate-700',
    brand:   'bg-brand/10 text-brand',
    muted:   'bg-ghost text-muted',
    emerald: 'bg-emerald-50 text-emerald-700',
    danger:  'bg-danger/10 text-danger',
    amber:   'bg-amber-50 text-amber-700',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider', tones[tone])}>
      {children}
    </span>
  )
}

function RecapRow({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-night', brand: 'text-brand', muted: 'text-muted', amber: 'text-amber-700' }
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-ghost/60 last:border-0">
      <span className="text-muted">{label}</span>
      <span className={clsx('font-extrabold font-mono', tones[tone])}>{value}</span>
    </div>
  )
}

function StatCard({ l, v, tone }) {
  const tones = {
    slate:   'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    brand:   'bg-brand/5 text-brand border-brand/20',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <div className={clsx('rounded-xl border-2 p-4 text-center', tones[tone])}>
      <p className="text-3xl font-extrabold leading-none">{v}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider mt-1.5 opacity-80">{l}</p>
    </div>
  )
}

function TplIconBtn({ icon, title, onClick, danger }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      title={title} aria-label={title}
      className={clsx(
        'w-6 h-6 rounded-md flex items-center justify-center bg-white/80 backdrop-blur border border-ghost shadow-sm transition',
        danger
          ? 'text-danger hover:bg-danger hover:text-white hover:border-danger'
          : 'text-muted hover:bg-brand hover:text-white hover:border-brand',
      )}>
      {icon}
    </button>
  )
}

function Dialog({ dialog, onClose }) {
  const [value, setValue] = useState(dialog.defaultValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (dialog.type === 'prompt') {
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && dialog.type === 'confirm') {
        e.preventDefault(); dialog.onConfirm?.(); onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, onClose])

  function submit(e) {
    e?.preventDefault()
    if (dialog.type === 'prompt') {
      if (!value.trim()) return
      dialog.onConfirm?.(value)
    } else dialog.onConfirm?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-night/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-ghost overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-start gap-3 p-5 border-b border-ghost">
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
            dialog.danger ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand')}>
            {dialog.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-bold text-night">{dialog.title}</h3>
            {dialog.message && <p className="text-xs text-muted leading-relaxed mt-1">{dialog.message}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted hover:bg-ghost flex items-center justify-center shrink-0 transition">
            <X size={16}/>
          </button>
        </header>
        <form onSubmit={submit} className="p-5 space-y-4">
          {dialog.type === 'prompt' && (
            <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
              placeholder={dialog.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-ghost text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"/>
          )}
          <div className="flex items-center justify-end gap-2">
            <Btn type="button" variant="secondary" size="sm" onClick={onClose}>Annuler</Btn>
            <Btn type="submit" size="sm"
              className={dialog.danger ? '!bg-danger hover:!bg-danger/90 !shadow-none' : ''}
              disabled={dialog.type === 'prompt' && !value.trim()}>
              {dialog.confirmLabel || 'Confirmer'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
