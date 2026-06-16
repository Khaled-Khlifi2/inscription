import { useEffect, useState, useCallback } from 'react'
import { listEtudiants, listNiveaux } from '../../services/adminApi'
import { StatCard, PageLoader, SectionHead, Btn } from '../../components/ui'
import {
  Users, CheckCircle, Clock, TrendingUp,
  Upload, Download, ArrowRight, GraduationCap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

export default function ScolariteDashboard() {
  const [stats, setStats]     = useState(null)
  const [niveaux, setNiveaux] = useState([])
  const [niveauId, setNivId]  = useState('')   // '' = tous niveaux
  const navigate = useNavigate()

  // Charger niveaux une fois
  useEffect(() => {
    listNiveaux().then(r => setNiveaux(r.data || [])).catch(() => {})
  }, [])

  // Recharger les stats à chaque changement de filtre
  const load = useCallback(() => {
    const base = niveauId !== '' ? { niveau_id: niveauId } : {}
    Promise.all([
      listEtudiants({ page: 1, size: 1, ...base }),
      listEtudiants({ page: 1, size: 1, inscription_complete: true,  ...base }),
      listEtudiants({ page: 1, size: 1, inscription_complete: false, ...base }),
    ]).then(([all, ok, pending]) => setStats({
      total: all.data.total, complete: ok.data.total, pending: pending.data.total,
    }))
  }, [niveauId])
  useEffect(() => { load() }, [load])

  if (!stats) return <PageLoader/>

  const pct = stats.total ? Math.round((stats.complete / stats.total) * 100) : 0
  const niveauSel = niveaux.find(n => String(n.id) === String(niveauId))

  return (
    <div>
      <SectionHead
        title="Tableau de bord"
        sub={
          niveauSel
            ? `Niveau ${niveauSel.libelle} — Année universitaire 2025/2026`
            : "Vue d'ensemble — Année universitaire 2025/2026"
        }
        action={
          <>
            <Btn variant="secondary" icon={<Upload size={15}/>} onClick={() => navigate('/admin/import')}>Import Excel</Btn>
            <Btn icon={<Download size={15}/>} onClick={() => navigate('/admin/export')}>Export SALIMA</Btn>
          </>
        }
      />

      {/* Filtre par niveau — chips minimalistes */}
      {niveaux.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-xs font-semibold text-mist flex items-center gap-1.5 mr-1">
            <GraduationCap size={13}/> Niveau
          </span>

          <button
            onClick={() => setNivId('')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
              niveauId === ''
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-mist border-ghost hover:border-fog hover:text-ink'
            )}
          >
            Tous
          </button>

          {niveaux.map(n => {
            const active = String(niveauId) === String(n.id)
            return (
              <button
                key={n.id}
                onClick={() => setNivId(String(n.id))}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize',
                  active
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-mist border-ghost hover:border-fog hover:text-ink'
                )}
              >
                {n.libelle || n.code}
              </button>
            )
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <StatCard label="Total étudiants"    value={stats.total}    icon={<Users size={22}/>}       color="blue" />
        <StatCard label="Inscrits"            value={stats.complete} icon={<CheckCircle size={22}/>} color="green" />
        <StatCard label="En attente"          value={stats.pending}  icon={<Clock size={22}/>}       color="amber" />
        <StatCard label="Taux d'inscription"  value={`${pct}%`}      icon={<TrendingUp size={22}/>}  color="blue" />
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-ghost shadow-sm p-7 mb-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="font-display font-bold text-ink text-lg">Progression des inscriptions</h3>
            <p className="text-mist text-sm mt-1">
              {stats.complete} étudiants inscrits sur {stats.total} au total
              {niveauSel && <span className="text-mist/70"> · {niveauSel.libelle}</span>}
            </p>
          </div>
          <span className="font-display text-4xl font-bold text-brand">{pct}%</span>
        </div>

        {/* Track segmenté inscrits + en attente */}
        <div className="w-full h-3 bg-ghost rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-brand to-teal-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
            title={`${stats.complete} inscrits`}
          />
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
            style={{ width: stats.total ? `${(stats.pending / stats.total) * 100}%` : '0%' }}
            title={`${stats.pending} en attente`}
          />
        </div>

        <div className="flex justify-between mt-3 text-xs font-semibold">
          <span className="text-success">✓ {stats.complete} inscrits</span>
          <span className="text-warn">⏳ {stats.pending} en attente</span>
        </div>
      </div>

      {/* Quick actions */}
      <h3 className="font-display font-bold text-ink mb-4">Actions rapides</h3>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Importer un fichier Excel', desc: 'Charger les étudiants depuis SALIMA', href: '/admin/import', icon: <Upload size={20}/>, color: 'text-brand bg-brand-soft' },
          { label: 'Gérer les étudiants',       desc: 'Consulter et modifier les dossiers',  href: '/admin/etudiants', icon: <Users size={20}/>, color: 'text-success bg-success-soft' },
          { label: 'Exporter vers SALIMA',      desc: 'Télécharger la liste des inscrits',   href: '/admin/export', icon: <Download size={20}/>, color: 'text-warn bg-warn-soft' },
        ].map(a => (
          <button
            key={a.href}
            onClick={() => navigate(a.href)}
            className="bg-white border border-ghost rounded-2xl p-5 text-left hover:border-brand/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${a.color}`}>{a.icon}</div>
            <p className="font-display font-bold text-ink text-sm">{a.label}</p>
            <p className="text-mist text-xs mt-1 mb-3">{a.desc}</p>
            <span className="text-brand text-xs font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Accéder <ArrowRight size={12}/>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
