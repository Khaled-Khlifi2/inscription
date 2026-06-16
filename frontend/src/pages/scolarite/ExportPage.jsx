/**
 * Export flexible des étudiants — côté Scolarité.
 *
 * Architecture :
 *   • Catalogue de champs servi par le backend (/scolarite/export/fields)
 *   • Modèles personnalisés créés par l'admin et persistés en localStorage
 *     → CRUD complet : créer, appliquer, renommer, dupliquer, supprimer
 *
 * Layout :
 *   ┌─ SectionHead ────────────────────────────────────────────┐
 *   ├─ Mes modèles (rangée horizontale, scroll si besoin) ─────┤
 *   ├─ Sidebar config (4/12) │ Builder colonnes (8/12) ────────┤
 *   └─ Barre d'action sticky (résumé + Enregistrer + Exporter) ┘
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Download, ArrowLeft, Search, FileSpreadsheet, FileText,
  Check, ChevronUp, ChevronDown, ChevronRight, X, RotateCcw,
  Filter, Layers, GripVertical, Plus, ListChecks, AlertTriangle,
  Trash2, FileDown, Edit3, Save, Copy, BookmarkPlus, FolderOpen,
} from 'lucide-react'
import clsx from 'clsx'
import { Btn, Input, SectionHead } from '../../components/ui'
import {
  getExportFields, exportCustom, listNiveaux,
  getExportFieldsResp, exportCustomResp, getResponsableProfile,
} from '../../services/adminApi'

// ── Adaptateur API selon le rôle ──────────────────────────────────
function buildExportApi(mode) {
  if (mode === 'responsable') {
    return {
      isResponsable: true,
      listNiveaux: () => getResponsableProfile().then(p => p?.niveau ? [p.niveau] : []),
      getExportFields: getExportFieldsResp,
      exportCustom: exportCustomResp,
    }
  }
  return {
    isResponsable: false,
    listNiveaux: () => listNiveaux().then(r => r.data),
    getExportFields,
    exportCustom,
  }
}

const FMT = [
  { value: 'xlsx', label: 'Excel', icon: <FileSpreadsheet size={14}/> },
  { value: 'csv',  label: 'CSV',   icon: <FileText size={14}/> },
]

const TEMPLATES_KEY = 'scolarite.export.templates.v1'

// ── Persistance localStorage ──────────────────────────────────────
function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') }
  catch { return [] }
}
function saveTemplates(list) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list))
}

export default function ExportPage({ mode = 'scolarite' } = {}) {
  const api = useMemo(() => buildExportApi(mode), [mode])
  const isResp = api.isResponsable
  const navigate = useNavigate()

  const [catalog, setCatalog]   = useState({ fields: [] })
  const [niveaux, setNiveaux]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)

  const [templates, setTemplates] = useState(loadTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [dialog, setDialog] = useState(null)  // { type, title, message, defaultValue, onConfirm, danger, confirmLabel }

  const [selected, setSelected]   = useState([])
  const [search, setSearch]       = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [format, setFormat]       = useState('xlsx')
  const [filename, setFilename]   = useState('etudiants_2025-2026')
  const [filters, setFilters]     = useState({ cfil: '', niveau_id: '', inscription_only: false })

  const dragKey = useRef(null)

  // ── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([api.getExportFields(), api.listNiveaux()])
      .then(([cat, nv]) => {
        setCatalog(cat)
        setNiveaux(nv || [])
        if (isResp && nv?.length === 1) {
          setFilters(f => ({ ...f, niveau_id: String(nv[0].id) }))
        }
      })
      .catch(() => toast.error('Erreur de chargement du catalogue'))
      .finally(() => setLoading(false))
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────
  const fieldByKey = useMemo(
    () => Object.fromEntries(catalog.fields.map(f => [f.key, f])),
    [catalog.fields],
  )

  const grouped = useMemo(() => {
    const g = {}
    for (const f of catalog.fields) {
      const q = search.trim().toLowerCase()
      if (q && !f.label.toLowerCase().includes(q) && !f.key.toLowerCase().includes(q)) continue
      ;(g[f.group] ??= []).push(f)
    }
    return g
  }, [catalog.fields, search])

  const selectedKeys = useMemo(() => new Set(selected.map(c => c.key)), [selected])
  const renamedCount = useMemo(
    () => selected.filter(c => c.label !== fieldByKey[c.key]?.label).length,
    [selected, fieldByKey],
  )

  // ── Actions champs ──────────────────────────────────────────────
  function toggle(key) {
    setActiveTemplateId(null)
    setSelected(prev => {
      const i = prev.findIndex(c => c.key === key)
      if (i >= 0) return prev.filter(c => c.key !== key)
      const meta = fieldByKey[key]
      return [...prev, { key, label: meta?.label || key }]
    })
  }
  function addGroup(group) {
    setActiveTemplateId(null)
    const fields = catalog.fields.filter(f => f.group === group)
    setSelected(prev => {
      const existing = new Set(prev.map(c => c.key))
      return [...prev, ...fields.filter(f => !existing.has(f.key)).map(f => ({ key: f.key, label: f.label }))]
    })
  }
  function removeGroup(group) {
    setActiveTemplateId(null)
    const keys = new Set(catalog.fields.filter(f => f.group === group).map(f => f.key))
    setSelected(prev => prev.filter(c => !keys.has(c.key)))
  }
  function updateLabel(key, lbl) {
    setSelected(prev => prev.map(c => c.key === key ? { ...c, label: lbl } : c))
  }
  function move(key, dir) {
    setSelected(prev => {
      const i = prev.findIndex(c => c.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function selectAll() { setActiveTemplateId(null); setSelected(catalog.fields.map(f => ({ key: f.key, label: f.label }))) }
  function clearAll()  { setActiveTemplateId(null); setSelected([]) }
  function resetLabels() {
    setSelected(prev => prev.map(c => ({ ...c, label: fieldByKey[c.key]?.label || c.key })))
    toast.success('Libellés réinitialisés')
  }
  const toggleGroup = (g) => setCollapsed(s => ({ ...s, [g]: !s[g] }))

  // ── Drag & drop ─────────────────────────────────────────────────
  const onDragStart = (e, key) => { dragKey.current = key; e.dataTransfer.effectAllowed = 'move' }
  const onDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function onDrop(e, target) {
    e.preventDefault()
    const src = dragKey.current; dragKey.current = null
    if (!src || src === target) return
    setSelected(prev => {
      const from = prev.findIndex(c => c.key === src)
      const to   = prev.findIndex(c => c.key === target)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [m] = next.splice(from, 1); next.splice(to, 0, m)
      return next
    })
  }

  // ── CRUD modèles ────────────────────────────────────────────────
  function persistTemplates(list) { setTemplates(list); saveTemplates(list) }

  function applyTemplate(t) {
    setActiveTemplateId(t.id)
    setSelected(t.columns.filter(c => fieldByKey[c.key]).map(c => ({ ...c })))
    if (t.format)   setFormat(t.format)
    if (t.filename) setFilename(t.filename)
    if (t.filters)  setFilters({ cfil: '', niveau_id: '', inscription_only: false, ...t.filters })
    toast.success(`Modèle « ${t.name} » appliqué`)
  }

  function saveAsTemplate() {
    if (!selected.length) return toast.error('Sélectionnez au moins une colonne avant d\'enregistrer')
    setDialog({
      type: 'prompt',
      title: 'Nouveau modèle d\'export',
      message: 'Donnez un nom à votre modèle pour le retrouver facilement.',
      placeholder: 'ex. Liste classe DSI 2025',
      defaultValue: `Modèle ${templates.length + 1}`,
      confirmLabel: 'Enregistrer',
      icon: <BookmarkPlus size={18}/>,
      onConfirm: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const t = {
          id: `tpl_${Date.now()}`,
          name: trimmed,
          columns: selected.map(c => ({ ...c })),
          format, filename,
          filters: { ...filters },
          createdAt: new Date().toISOString(),
        }
        persistTemplates([...templates, t])
        setActiveTemplateId(t.id)
        toast.success(`Modèle « ${trimmed} » enregistré`)
      },
    })
  }

  function updateActiveTemplate() {
    if (!activeTemplateId) return
    persistTemplates(templates.map(t =>
      t.id === activeTemplateId
        ? { ...t, columns: selected.map(c => ({ ...c })), format, filename, filters: { ...filters }, updatedAt: new Date().toISOString() }
        : t
    ))
    toast.success('Modèle mis à jour')
  }

  function renameTemplate(t) {
    setDialog({
      type: 'prompt',
      title: 'Renommer le modèle',
      message: 'Choisissez un nouveau nom pour ce modèle.',
      placeholder: 'Nom du modèle',
      defaultValue: t.name,
      confirmLabel: 'Renommer',
      icon: <Edit3 size={18}/>,
      onConfirm: (name) => {
        const trimmed = name.trim()
        if (!trimmed || trimmed === t.name) return
        persistTemplates(templates.map(x => x.id === t.id ? { ...x, name: trimmed } : x))
        toast.success('Modèle renommé')
      },
    })
  }

  function duplicateTemplate(t) {
    const copy = { ...t, id: `tpl_${Date.now()}`, name: `${t.name} (copie)`, createdAt: new Date().toISOString() }
    persistTemplates([...templates, copy])
    toast.success('Modèle dupliqué')
  }

  function deleteTemplate(t) {
    setDialog({
      type: 'confirm',
      title: 'Supprimer ce modèle ?',
      message: <>Vous êtes sur le point de supprimer définitivement le modèle <strong>« {t.name} »</strong>. Cette action est irréversible.</>,
      confirmLabel: 'Supprimer',
      danger: true,
      icon: <AlertTriangle size={18}/>,
      onConfirm: () => {
        persistTemplates(templates.filter(x => x.id !== t.id))
        if (activeTemplateId === t.id) setActiveTemplateId(null)
        toast.success('Modèle supprimé')
      },
    })
  }

  // ── Export ──────────────────────────────────────────────────────
  async function handleExport() {
    if (!selected.length) return toast.error('Sélectionnez au moins une colonne')
    setExporting(true)
    try {
      await api.exportCustom({
        columns: selected,
        format,
        filename: filename.trim() || 'etudiants',
        cfil: filters.cfil || null,
        niveau_id: filters.niveau_id ? Number(filters.niveau_id) : null,
        inscription_only: filters.inscription_only,
      })
      toast.success('Export généré')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">Chargement du catalogue…</div>
  }

  // ══════════════════════════════════════════════════════════════
  //  Rendu
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="pb-28 space-y-10">
      <SectionHead
        title={isResp ? 'Export — étudiants de mon niveau' : 'Export des étudiants'}
        sub={isResp
          ? 'L\'export ne contient que les étudiants de votre niveau. Composez vos colonnes et enregistrez vos modèles.'
          : 'Composez votre fichier d\'export sur mesure et enregistrez vos modèles pour réutilisation.'}
        action={
          <Btn variant="secondary" icon={<ArrowLeft size={15}/>} onClick={() => navigate(-1)}>
            Retour
          </Btn>
        }
      />

      {/* ════════════ MES MODÈLES ════════════ */}
      <Card
        icon={<FolderOpen size={16}/>}
        title="Mes modèles d'export"
        subtitle={templates.length
          ? `${templates.length} modèle${templates.length > 1 ? 's' : ''} enregistré${templates.length > 1 ? 's' : ''}`
          : 'Aucun modèle pour l\'instant'}
        right={
          <Btn size="sm" variant="secondary" icon={<BookmarkPlus size={13}/>} onClick={saveAsTemplate}>
            Enregistrer la configuration actuelle
          </Btn>
        }
      >
        {!templates.length ? (
          <div className="flex flex-col items-center text-center py-10 px-6">
            <div className="w-16 h-16 rounded-2xl bg-brand/5 text-brand/60 flex items-center justify-center mb-3">
              <BookmarkPlus size={26}/>
            </div>
            <h4 className="text-sm font-bold text-night mb-1">Créez votre premier modèle</h4>
            <p className="text-xs text-muted max-w-md leading-relaxed">
              Configurez les champs, libellés, ordre et filtres ci-dessous, puis cliquez sur
              <span className="font-bold text-brand"> « Enregistrer la configuration actuelle » </span>
              pour réutiliser ce modèle plus tard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map(t => {
              const active = activeTemplateId === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className={clsx(
                    'group relative rounded-2xl border-2 p-4 cursor-pointer transition-all',
                    active
                      ? 'border-brand bg-brand/5 shadow-md'
                      : 'border-ghost bg-white hover:border-brand/50 hover:shadow-md hover:-translate-y-0.5',
                  )}
                >
                  {/* Toolbar discret en haut à droite */}
                  <div
                    className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {active && (
                      <TplIconBtn
                        icon={<Save size={13}/>}
                        title="Mettre à jour ce modèle avec la configuration actuelle"
                        onClick={updateActiveTemplate}
                      />
                    )}
                    <TplIconBtn icon={<Edit3 size={13}/>}  title="Renommer"  onClick={() => renameTemplate(t)}/>
                    <TplIconBtn icon={<Copy size={13}/>}   title="Dupliquer" onClick={() => duplicateTemplate(t)}/>
                    <TplIconBtn icon={<Trash2 size={13}/>} title="Supprimer" danger onClick={() => deleteTemplate(t)}/>
                  </div>

                  {/* Contenu carte */}
                  <div className="flex items-start gap-3">
                    <div className={clsx(
                      'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition',
                      active ? 'bg-brand text-white shadow-sm' : 'bg-brand/10 text-brand group-hover:bg-brand/15',
                    )}>
                      <Layers size={18}/>
                    </div>
                    <div className="min-w-0 flex-1 pr-12">
                      <h5 className="font-bold text-sm text-night truncate leading-tight">{t.name}</h5>
                      <div className="flex items-center gap-1.5 text-[11px] mt-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-ghost text-muted font-mono font-semibold">
                          {t.columns.length} col.
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-ghost text-muted font-mono font-semibold uppercase">
                          {t.format || 'xlsx'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {active && (
                    <div className="absolute -top-2 left-4 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand text-white shadow-sm">
                      Actif
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ════════════ CONFIG + BUILDER ════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Sidebar config */}
        <aside className="xl:col-span-4 space-y-6">
          <Card icon={<Filter size={15}/>} title="Filtres" subtitle="Périmètre des étudiants à exporter">
            <Field label="Code filière (CFIL)">
              <Input
                value={filters.cfil}
                onChange={e => setFilters(f => ({ ...f, cfil: e.target.value }))}
                placeholder="ex. LFIG"
                className="font-mono uppercase tracking-wider"
              />
            </Field>
            <Field label={isResp ? "Niveau (verrouillé)" : "Niveau d'études"}>
              {isResp ? (
                <div className="w-full px-3 py-2.5 rounded-xl border-2 border-brand/30 bg-brand/5 text-sm font-bold text-brand flex items-center gap-2">
                  <Layers size={13}/>
                  <span className="capitalize truncate flex-1">
                    {niveaux[0]?.libelle || '—'}
                  </span>
                  {niveaux[0]?.code && <code className="text-[10px] font-mono opacity-70">{niveaux[0].code}</code>}
                </div>
              ) : (
              <select
                value={filters.niveau_id}
                onChange={e => setFilters(f => ({ ...f, niveau_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-ghost text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
              >
                <option value="">— Tous les niveaux —</option>
                {niveaux.map(n => (
                  <option key={n.id} value={n.id}>{n.libelle}{n.code ? ` (${n.code})` : ''}</option>
                ))}
              </select>
              )}
            </Field>
            <label className="flex items-start gap-3 p-3 rounded-xl border border-ghost hover:border-brand/40 cursor-pointer transition">
              <input
                type="checkbox"
                checked={filters.inscription_only}
                onChange={e => setFilters(f => ({ ...f, inscription_only: e.target.checked }))}
                className="w-4 h-4 mt-0.5 accent-brand"
              />
              <div>
                <div className="text-[13px] font-semibold text-night">Inscriptions validées uniquement</div>
                <div className="text-[11px] text-muted leading-snug mt-0.5">Exclure les dossiers en attente, refusés ou sans dossier.</div>
              </div>
            </label>
          </Card>

          <Card icon={<FileDown size={15}/>} title="Format & fichier" subtitle="Sortie générée">
            <Field label="Format de sortie">
              <div className="grid grid-cols-2 gap-2.5">
                {FMT.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={clsx(
                      'flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-bold transition',
                      format === f.value
                        ? 'border-brand bg-brand/5 text-brand shadow-sm'
                        : 'border-ghost text-muted hover:border-brand/40 hover:bg-ghost/30',
                    )}
                  >
                    {f.icon}{f.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Nom du fichier">
              <div className="flex items-stretch rounded-xl border border-ghost overflow-hidden focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 bg-white">
                <input
                  value={filename}
                  onChange={e => setFilename(e.target.value)}
                  placeholder="etudiants_2025-2026"
                  className="flex-1 px-3 py-2.5 text-sm font-mono outline-none bg-transparent"
                />
                <span className="flex items-center px-3 bg-ghost/40 text-xs font-mono font-bold text-muted border-l border-ghost">
                  .{format}
                </span>
              </div>
            </Field>
          </Card>
        </aside>

        {/* Builder */}
        <section className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Disponibles */}
          <Card
            icon={<ListChecks size={15}/>}
            title="Champs disponibles"
            subtitle={`${catalog.fields.length} champs au total`}
            right={
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={selectAll} className="font-bold text-brand hover:underline">Tout</button>
                <span className="text-muted/50">·</span>
                <button onClick={clearAll}  className="font-bold text-danger hover:underline">Vider</button>
              </div>
            }
          >
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un champ…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-ghost text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
              />
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 -mr-1">
              {Object.entries(grouped).map(([group, fields]) => {
                const isOpen = !collapsed[group]
                const sel = fields.filter(f => selectedKeys.has(f.key)).length
                const all = sel === fields.length
                return (
                  <div key={group} className="rounded-xl border border-ghost bg-white overflow-hidden">
                    <header className="flex items-center gap-2 px-3 py-2.5 bg-ghost/30 border-b border-ghost">
                      <button onClick={() => toggleGroup(group)} className="flex items-center gap-1.5 flex-1 text-left">
                        <ChevronRight size={13} className={clsx('transition-transform text-muted', isOpen && 'rotate-90')}/>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-night">{group}</span>
                      </button>
                      <span className={clsx(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded-md',
                        sel > 0 ? 'bg-brand/10 text-brand' : 'bg-ghost text-muted',
                      )}>
                        {sel}/{fields.length}
                      </span>
                      <button
                        onClick={() => all ? removeGroup(group) : addGroup(group)}
                        className={clsx(
                          'text-[10px] font-bold px-2 py-1 rounded-md transition',
                          all ? 'text-danger hover:bg-danger/10' : 'text-brand hover:bg-brand/10',
                        )}
                      >
                        {all ? 'Retirer' : '+ Tout'}
                      </button>
                    </header>
                    {isOpen && (
                      <div className="p-2 space-y-0.5">
                        {fields.map(f => {
                          const isSel = selectedKeys.has(f.key)
                          return (
                            <button
                              key={f.key}
                              onClick={() => toggle(f.key)}
                              className={clsx(
                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition group',
                                isSel ? 'bg-brand/10 text-brand font-semibold' : 'hover:bg-ghost/50 text-night',
                              )}
                            >
                              <span className={clsx(
                                'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition',
                                isSel ? 'bg-brand border-brand' : 'border-ghost group-hover:border-brand/60',
                              )}>
                                {isSel && <Check size={10} className="text-white" strokeWidth={3.5}/>}
                              </span>
                              <span className="flex-1 truncate">{f.label}</span>
                              <code className="text-[10px] text-muted/70 font-mono">{f.key}</code>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {!Object.keys(grouped).length && (
                <div className="text-xs text-muted italic text-center py-10">Aucun champ ne correspond.</div>
              )}
            </div>
          </Card>

          {/* Sélectionnés */}
          <Card
            icon={<Edit3 size={15}/>}
            title="Colonnes à exporter"
            subtitle={selected.length
              ? `${selected.length} colonne${selected.length > 1 ? 's' : ''}${renamedCount ? ` · ${renamedCount} renommée${renamedCount > 1 ? 's' : ''}` : ''}`
              : 'Aucune sélection'}
            right={
              selected.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button onClick={resetLabels} className="flex items-center gap-1 font-bold text-muted hover:text-brand">
                    <RotateCcw size={11}/> Libellés
                  </button>
                  <span className="text-muted/50">·</span>
                  <button onClick={clearAll} className="flex items-center gap-1 font-bold text-danger hover:underline">
                    <Trash2 size={11}/> Vider
                  </button>
                </div>
              )
            }
          >
            {!selected.length ? (
              <EmptyState
                icon={<Plus size={28}/>}
                title="Aucune colonne sélectionnée"
                hint="Cochez les champs à gauche pour construire votre export."
              />
            ) : (
              <div className="space-y-2 max-h-[660px] overflow-y-auto pr-1 -mr-1">
                {selected.map((c, idx) => {
                  const meta = fieldByKey[c.key]
                  const renamed = meta && c.label !== meta.label
                  return (
                    <div
                      key={c.key}
                      draggable
                      onDragStart={(e) => onDragStart(e, c.key)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, c.key)}
                      className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-ghost hover:border-brand/50 hover:shadow-sm transition cursor-move"
                    >
                      <GripVertical size={14} className="text-muted/60 shrink-0"/>
                      <span className="text-[10px] font-extrabold font-mono text-muted w-6 text-center">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={c.label}
                            onChange={e => updateLabel(c.key, e.target.value)}
                            className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-ghost focus:border-brand outline-none text-sm font-semibold text-night transition"
                          />
                          {renamed && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              modifié
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-muted truncate">
                          <code>{c.key}</code>
                          {renamed && <> · défaut : <span className="text-muted/70">{meta.label}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <IconBtn onClick={() => move(c.key, -1)} disabled={idx === 0} title="Monter">
                          <ChevronUp size={13}/>
                        </IconBtn>
                        <IconBtn onClick={() => move(c.key,  1)} disabled={idx === selected.length - 1} title="Descendre">
                          <ChevronDown size={13}/>
                        </IconBtn>
                        <IconBtn onClick={() => toggle(c.key)} danger title="Retirer">
                          <X size={13}/>
                        </IconBtn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </section>
      </div>

      {/* ════════════ BARRE D'ACTION STICKY ════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-ghost shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <div className="max-w-screen-2xl mx-auto px-6 py-3.5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
            <SummaryChip icon={<ListChecks size={13}/>} label="Colonnes" value={selected.length} tone={selected.length ? 'brand' : 'muted'}/>
            {renamedCount > 0 && <SummaryChip icon={<Edit3 size={13}/>} label="Renommées" value={renamedCount} tone="amber"/>}
            <SummaryChip icon={FMT.find(f => f.value === format)?.icon} label="Format" value={format.toUpperCase()} tone="slate"/>
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted truncate">
              <FileDown size={13}/>
              <span className="font-mono truncate">{(filename || 'etudiants').trim()}.{format}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTemplateId && (
              <Btn
                size="md"
                variant="secondary"
                icon={<Save size={14}/>}
                onClick={updateActiveTemplate}
                title="Mettre à jour le modèle actif avec la configuration actuelle"
              >
                Sauver le modèle
              </Btn>
            )}
            <Btn
              size="md"
              variant="secondary"
              icon={<BookmarkPlus size={14}/>}
              onClick={saveAsTemplate}
              disabled={!selected.length}
            >
              Enregistrer comme modèle
            </Btn>
            <Btn
              size="lg"
              icon={<Download size={16}/>}
              onClick={handleExport}
              disabled={!selected.length || exporting}
            >
              {exporting ? 'Génération…' : 'Télécharger'}
            </Btn>
          </div>
        </div>
      </div>

      {/* ════════════ MODALE (prompt + confirm) ════════════ */}
      {dialog && (
        <Dialog
          dialog={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//  Sous-composants
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
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-2">{label}</label>
      {children}
    </div>
  )
}

function IconBtn({ children, onClick, disabled, danger, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'w-7 h-7 rounded-md flex items-center justify-center transition',
        disabled && 'opacity-30 cursor-not-allowed',
        !disabled && (danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-brand/10 hover:text-brand'),
      )}
    >
      {children}
    </button>
  )
}

function TplIconBtn({ icon, title, onClick, danger, disabled }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        'w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 backdrop-blur border border-ghost shadow-sm transition',
        disabled && 'opacity-30 cursor-not-allowed',
        !disabled && (danger
          ? 'text-danger hover:bg-danger hover:text-white hover:border-danger'
          : 'text-muted hover:bg-brand hover:text-white hover:border-brand'),
      )}
    >
      {icon}
    </button>
  )
}

function EmptyState({ icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-16 h-16 rounded-2xl bg-ghost/50 text-muted flex items-center justify-center mb-3">{icon}</div>
      <div className="text-sm font-bold text-night mb-1">{title}</div>
      <div className="text-xs text-muted max-w-xs leading-relaxed">{hint}</div>
    </div>
  )
}

function Dialog({ dialog, onClose }) {
  const [value, setValue] = useState(dialog.defaultValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (dialog.type === 'prompt') {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && dialog.type === 'confirm') {
        e.preventDefault()
        dialog.onConfirm?.()
        onClose()
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
    } else {
      dialog.onConfirm?.()
    }
    onClose()
  }

  const accentClass = dialog.danger
    ? 'bg-danger/10 text-danger'
    : 'bg-brand/10 text-brand'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-night/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-ghost overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 p-5 border-b border-ghost">
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', accentClass)}>
            {dialog.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-bold text-night">{dialog.title}</h3>
            {dialog.message && (
              <p className="text-xs text-muted leading-relaxed mt-1">{dialog.message}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted hover:bg-ghost flex items-center justify-center shrink-0 transition"
            aria-label="Fermer"
          >
            <X size={16}/>
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-4">
          {dialog.type === 'prompt' && (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={dialog.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-ghost text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" size="sm" onClick={onClose}>
              Annuler
            </Btn>
            <Btn
              type="submit"
              size="sm"
              variant={dialog.danger ? 'primary' : 'primary'}
              className={dialog.danger ? '!bg-danger hover:!bg-danger/90 !shadow-none' : ''}
              disabled={dialog.type === 'prompt' && !value.trim()}
            >
              {dialog.confirmLabel || 'Confirmer'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function SummaryChip({ icon, label, value, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand/10 text-brand border-brand/20',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    muted: 'bg-ghost text-muted border-ghost',
  }
  return (
    <div className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold', tones[tone])}>
      {icon}
      <span className="text-muted font-medium">{label}</span>
      <span className="font-extrabold">{value}</span>
    </div>
  )
}
