import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import {
  GraduationCap, LayoutDashboard, Users,
  Upload, Download, LogOut, ChevronRight, Shield
} from 'lucide-react'
import clsx from 'clsx'

const SCOLARITE_NAV = [
  { to: '/admin/dashboard',    icon: LayoutDashboard, label: 'Tableau de bord',  end: true },
  { to: '/admin/etudiants',    icon: Users,           label: 'Étudiants' },
  { to: '/admin/import',       icon: Upload,          label: 'Import Excel' },
  { to: '/admin/export',       icon: Download,        label: 'Export SALIMA' },
  { to: '/admin/responsables', icon: Shield,          label: 'Responsables' },
]

const RESPONSABLE_NAV = [
  { to: '/admin/responsable',        icon: Users,    label: 'Étudiants & Dossiers', end: true },
  { to: '/admin/responsable/import', icon: Upload,   label: 'Import' },
  { to: '/admin/responsable/export', icon: Download, label: 'Export' },
]

export default function AdminLayout() {
  const { logout, role, isScolarite, isResponsable } = useAdminAuth()
  const navigate = useNavigate()
  const nav = isScolarite ? SCOLARITE_NAV : RESPONSABLE_NAV

  const roleLabel    = isScolarite ? 'Administration' : 'Responsable de niveau'
  const sidebarColor = isScolarite ? 'bg-ink' : 'bg-[#0F2744]'   // bleu foncé distinct

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar admin ── */}
      <aside className={`w-60 shrink-0 ${sidebarColor} flex flex-col sticky top-0 h-screen`}>
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isScolarite ? 'bg-brand' : 'bg-teal-600'}`}>
              {isScolarite
                ? <GraduationCap size={18} className="text-white" />
                : <Shield size={18} className="text-white" />}
            </div>
            <div>
              <p className="font-display text-white font-bold text-base leading-none">ISI</p>
              <p className="text-white/40 text-[0.65rem] uppercase tracking-widest mt-1">
                {isScolarite ? 'Scolarité' : 'Responsable'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? isScolarite ? 'bg-brand text-white' : 'bg-teal-600 text-white'
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
            {roleLabel}
          </p>
          <button
            onClick={() => { logout(); navigate('/admin/login') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <main className="flex-1 bg-ghost overflow-x-hidden">
        <div className="max-w-[1200px] p-9 animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
