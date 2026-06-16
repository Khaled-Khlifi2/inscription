import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { loginScolarite, loginResponsable } from '../../services/adminApi'
import { Btn, Input } from '../../components/ui'
import toast from 'react-hot-toast'
import { Shield, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'

/**
 * Connexion unifiée : un seul formulaire pour scolarité ET responsables.
 * Le rôle est déterminé automatiquement depuis l'identifiant.
 *
 * Stratégie :
 *   1. Essayer le login scolarité.
 *   2. Si 401/404 → essayer le login responsable.
 *   3. Si les deux échouent → message d'erreur générique.
 *
 * Avantage : aucune sélection manuelle, l'utilisateur n'a pas à savoir
 * dans quelle "case" son compte se trouve.
 */
export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setL] = useState(false)
  const { login }       = useAdminAuth()
  const navigate        = useNavigate()
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  /** Tente un endpoint ; renvoie la réponse axios ou null si 401/404. */
  const tryLogin = async (loginFn) => {
    try {
      return await loginFn(form.email, form.password)
    } catch (err) {
      const code = err.response?.status
      // 401 = credentials invalides pour ce rôle, 404 = compte inexistant.
      // Toute autre erreur (réseau, 500…) doit remonter.
      if (code === 401 || code === 404) return null
      throw err
    }
  }

  const submit = async e => {
    e.preventDefault(); setL(true)
    try {
      // 1. Scolarité d'abord (la plupart des comptes admin globaux)
      let res = await tryLogin(loginScolarite)
      // 2. Fallback responsable
      if (!res) res = await tryLogin(loginResponsable)
      // 3. Aucune des deux n'a fonctionné
      if (!res) {
        toast.error('Email ou mot de passe incorrect')
        return
      }

      // Extraire niveau_id du token JWT si responsable
      let niveauId = null
      if (res.data.role === 'responsable') {
        try {
          const payload = JSON.parse(atob(res.data.access_token.split('.')[1]))
          niveauId = payload.niveau_id || null
        } catch {}
      }

      login(res.data.access_token, res.data.role, niveauId)
      toast.success('Connexion réussie')
      navigate(res.data.role === 'scolarite' ? '/admin/dashboard' : '/admin/responsable')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion')
    } finally { setL(false) }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden
                    bg-gradient-to-br from-[#0a1420] via-[#0F1923] to-[#0b1f2b]">

      {/* Halos décoratifs — n'interceptent pas les clics */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-teal-500/15 blur-3xl"/>
        <div className="absolute -bottom-40 -right-32 w-[480px] h-[480px] rounded-full bg-brand/15 blur-3xl"/>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-3xl"/>
      </div>

      <div className="w-full max-w-[440px] relative z-10">

        {/* Logo admin */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-brand rounded-2xl blur-md opacity-50"/>
            <div className="relative w-16 h-16 bg-gradient-to-br from-teal-500 to-brand rounded-2xl
                            flex items-center justify-center shadow-2xl ring-1 ring-white/10">
              <Shield size={30} className="text-white drop-shadow"/>
            </div>
          </div>
          <h1 className="font-display text-3xl font-black text-white tracking-tight">ISI Ariana</h1>
          <p className="text-white/50 text-sm mt-1.5 font-medium">Portail Administration</p>
          <div className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.07] rounded-full
                          border border-white/10 backdrop-blur-sm">
            <Sparkles size={11} className="text-teal-400"/>
            <p className="text-white/70 text-[0.65rem] uppercase tracking-[0.18em] font-semibold">
              Accès réservé au personnel
            </p>
          </div>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 ring-1 ring-black/5">
          <h2 className="font-display text-xl font-bold text-ink mb-1">Connexion</h2>
          <p className="text-sm text-mist mb-6">Scolarité &amp; responsables de niveau</p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input label="Email" type="email"
              placeholder="email@isi.tn"
              value={form.email} onChange={set('email')}
              icon={<Mail size={15}/>} required autoFocus />
            <Input label="Mot de passe" type="password" placeholder="••••••••"
              value={form.password} onChange={set('password')}
              icon={<Lock size={15}/>} required />
            <Btn type="submit" size="lg" loading={loading} className="w-full justify-center mt-2">
              {loading ? 'Connexion…' : <><span>Se connecter</span><ArrowRight size={16}/></>}
            </Btn>
          </form>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          © {new Date().getFullYear()} ISI Ariana — Interface d'administration sécurisée
        </p>
      </div>
    </div>
  )
}
