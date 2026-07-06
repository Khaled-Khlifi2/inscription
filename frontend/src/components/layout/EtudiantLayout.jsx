import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useEtudiantAuth } from '../../context/EtudiantAuthContext'
import { GraduationCap, UserCircle, ClipboardCheck, LogOut, ChevronRight, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/etudiant/dossier',      icon: UserCircle,     label: 'Mon dossier',     end: true },
  { to: '/etudiant/inscription',  icon: ClipboardCheck, label: 'Mon inscription' },
  { to: '/etudiant/reglement',    icon: ShieldCheck,    label: 'Reglement interne' },
]

export default function EtudiantLayout() {
  const { logout } = useEtudiantAuth()
  const navigate   = useNavigate()

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar étudiant ── */}
      <aside className="w-60 shrink-0 bg-ink flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center shrink-0">
              <GraduationCap size={18} className="text-white" />
            </div>
            <div>
              <p className="font-display text-white font-bold text-base leading-none">ISI</p>
              <p className="text-white/40 text-[0.65rem] uppercase tracking-widest mt-1">
                Espace Étudiant
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.07]'
              )}>
              {({ isActive }) => (
                <>
                  <Icon size={17} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="opacity-60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/[0.07]">
          <p className="text-[0.65rem] uppercase tracking-widest text-white/25 font-medium px-3 mb-2">
            Espace personnel
          </p>
          <button
            onClick={() => { logout(); navigate('/etudiant/login') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <main className="flex-1 bg-ghost overflow-x-hidden">
        <div className="max-w-[1100px] p-9 animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
