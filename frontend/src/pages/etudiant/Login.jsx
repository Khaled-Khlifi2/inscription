import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEtudiantAuth } from '../../context/EtudiantAuthContext'
import { loginEtudiant, loginEtudiantOtp } from '../../services/etudiantApi'
import { Btn } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  GraduationCap, CreditCard, Mail, ArrowRight,
  CheckCircle, User, ChevronDown, AlertTriangle, X,
} from 'lucide-react'
import clsx from 'clsx'

function Stepper({ step }) {
  const steps = [{ n: 1, label: 'Identification' }, { n: 2, label: 'Vérification email' }]
  return (
    <div className="flex items-center mb-8 px-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 min-w-0">
          <div className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all duration-300',
            step > s.n  ? 'bg-success text-white' :
            step === s.n ? 'bg-brand text-white ring-4 ring-brand/20' : 'bg-fog text-mist'
          )}>
            {step > s.n ? <CheckCircle size={15}/> : s.n}
          </div>
          <span className={clsx('text-xs font-semibold ml-2 truncate', step === s.n ? 'text-ink' : 'text-mist')}>{s.label}</span>
          {i === 0 && <div className="flex-1 h-px bg-fog mx-3 shrink-0 min-w-4" />}
        </div>
      ))}
    </div>
  )
}

function OtpInput({ value, onChange }) {
  return (
    <div>
      <label className="block text-[0.8125rem] font-semibold text-ink mb-2">
        Code OTP <span className="text-mist font-normal">(6 chiffres)</span>
      </label>
      <input
        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
        autoFocus required placeholder="— — — — — —"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        className={clsx(
          'w-full bg-white border-[1.5px] rounded-2xl px-4 py-5',
          'text-ink text-3xl font-bold text-center tracking-[0.6em]',
          'outline-none transition-all duration-150',
          'placeholder:text-fog/50 placeholder:text-lg placeholder:tracking-[0.3em]',
          value.length === 6 ? 'border-success ring-2 ring-success/10' : 'border-fog focus:border-brand focus:ring-2 focus:ring-brand/10'
        )}
      />
      <div className="flex justify-between mt-1.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={clsx('h-1 rounded-full flex-1 mx-0.5 transition-all duration-150', i < value.length ? 'bg-brand' : 'bg-ghost')} />
        ))}
      </div>
    </div>
  )
}

export default function EtudiantLogin() {
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState({ mat_cin: '', nom_fr: '', prenom_fr: '', email: '', code: '' })
  const [loading, setL]     = useState(false)
  const [showHelp, setHelp] = useState(false)
  const [globalError, setGlobalError] = useState(null)
  const { login }           = useEtudiantAuth()
  const navigate            = useNavigate()
  const set = k => e => {
    setForm(f => ({ ...f, [k]: typeof e === 'string' ? e : e.target.value }))
    if (globalError) setGlobalError(null)
  }

  const handleStep1 = async e => {
    e.preventDefault()
    setGlobalError(null)
    if (!form.mat_cin.trim() || !form.nom_fr.trim() || !form.prenom_fr.trim() || !form.email.trim()) {
      setGlobalError('Tous les champs sont obligatoires.')
      return
    }
    setL(true)
    try {
      const res = await loginEtudiant(form.mat_cin.trim(), form.email.trim(), form.nom_fr.trim(), form.prenom_fr.trim())
      if (res.data.require_otp === false) {
        login(res.data.access_token, res.data.role)
        toast.success('Connexion réussie — bienvenue !')
        navigate('/etudiant/inscription')
      } else {
        toast.success('Code de vérification envoyé à votre email')
        setStep(2)
      }
    } catch {
      // Message générique : on ne révèle PAS quel champ est incorrect
      // (confidentialité + professionnalisme). L'étudiant relit ses champs.
      // Les valeurs saisies restent intactes (state `form` non touché).
      setGlobalError(
        "Une ou plusieurs informations saisies sont incorrectes. " +
        "Vérifiez votre CIN, votre nom, votre prénom et votre email puis réessayez."
      )
    } finally { setL(false) }
  }

  const handleStep2 = async e => {
    e.preventDefault()
    setGlobalError(null)
    if (form.code.length !== 6) { setGlobalError('Code OTP incomplet (6 chiffres requis).'); return }
    setL(true)
    try {
      const res = await loginEtudiantOtp(form.mat_cin.trim(), form.email.trim(), form.code.trim())
      login(res.data.access_token, res.data.role)
      toast.success('Email vérifié — bienvenue !')
      navigate('/etudiant/inscription')
    } catch {
      setGlobalError('Code OTP invalide ou expiré. Vérifiez votre boîte mail et réessayez.')
    } finally { setL(false) }
  }

  const resendOtp = async () => {
    setL(true)
    try {
      await loginEtudiant(form.mat_cin.trim(), form.email.trim(), form.nom_fr.trim(), form.prenom_fr.trim())
      toast.success('Nouveau code envoyé !')
    } catch { toast.error('Erreur lors du renvoi') }
    finally { setL(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0F1923 0%, #1a2e40 50%, #0d2235 100%)' }}>

      {/* Panneau gauche branding */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div>
              <p className="font-display text-white font-bold text-lg leading-none">ISI Ariana</p>
              <p className="text-white/40 text-xs uppercase tracking-widest mt-0.5">Institut Supérieur de l'Informatique</p>
            </div>
          </div>

          <h2 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Portail<br/>d'inscription<br/>étudiant
          </h2>
          <p className="text-white/40 text-base leading-relaxed">
            Accédez à votre dossier, complétez votre formulaire et suivez l'état de votre inscription.
          </p>

          <div className="mt-12 flex flex-col gap-4">
            {[
              { n: '1', t: 'Identifiez-vous',        d: 'CIN, nom, prénom et email' },
              { n: '2', t: 'Vérifiez votre email',   d: 'Code OTP à 6 chiffres' },
              { n: '3', t: 'Complétez votre dossier',d: 'Informations et pièces jointes' },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-brand font-bold text-sm">{s.n}</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{s.t}</p>
                  <p className="text-white/40 text-xs">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs relative z-10">
          © {new Date().getFullYear()} ISI Ariana — Ministère de l'Enseignement Supérieur
        </p>
      </div>

      {/* Panneau droit formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[460px]">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <p className="font-display text-white font-bold leading-none">ISI Ariana</p>
              <p className="text-white/40 text-xs uppercase tracking-wider">Portail Étudiant</p>
            </div>
          </div>

          <Stepper step={step} />

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-6 border-b border-ghost">
              <h2 className="font-display text-xl font-bold text-ink">
                {step === 1 ? 'Connexion à votre espace' : 'Vérification de votre email'}
              </h2>
              <p className="text-mist text-sm mt-1">
                {step === 1
                  ? 'Renseignez vos informations personnelles pour accéder à votre dossier'
                  : <span>Code envoyé à <strong className="text-ink">{form.email}</strong></span>
                }
              </p>
            </div>

            <div className="px-8 py-7">

              {/* ÉTAPE 1 */}
              {step === 1 && (
                <form onSubmit={handleStep1} className="flex flex-col gap-5">

                  {/* Bandeau d'erreur générique (non spécifique au champ) */}
                  {globalError && (
                    <div className="flex items-start gap-3 bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3.5 animate-fade-in">
                      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} className="text-white"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-red-800 leading-tight">Informations incorrectes</p>
                        <p className="text-xs text-red-700 mt-1 leading-snug">{globalError}</p>
                      </div>
                      <button type="button" onClick={() => setGlobalError(null)}
                        className="text-red-400 hover:text-red-600 shrink-0 p-1">
                        <X size={14}/>
                      </button>
                    </div>
                  )}

                  {/* CIN */}
                  <div>
                    <label className="block text-[0.8125rem] font-semibold text-ink mb-2">
                      Numéro CIN <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                      <input type="text" value={form.mat_cin} onChange={set('mat_cin')}
                        placeholder="Ex : 12345678" required autoFocus
                        className="w-full bg-white border-[1.5px] border-fog rounded-xl pl-11 pr-4 py-3 text-ink text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all font-mono tracking-wider uppercase" />
                    </div>
                  </div>

                  {/* Nom + Prénom */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[0.8125rem] font-semibold text-ink mb-2">
                        Nom <span className="text-danger">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                        <input type="text" value={form.nom_fr} onChange={set('nom_fr')}
                          placeholder="Votre nom exact" required
                          className="w-full bg-white border-[1.5px] border-fog rounded-xl pl-10 pr-3 py-3 text-ink text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[0.8125rem] font-semibold text-ink mb-2">
                        Prénom <span className="text-danger">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                        <input type="text" value={form.prenom_fr} onChange={set('prenom_fr')}
                          placeholder="Prénom" required
                          className="w-full bg-white border-[1.5px] border-fog rounded-xl pl-10 pr-3 py-3 text-ink text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Séparateur */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-ghost" />
                    <span className="text-xs text-fog font-medium">puis</span>
                    <div className="flex-1 h-px bg-ghost" />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[0.8125rem] font-semibold text-ink mb-2">
                      Adresse email <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                      <input type="email" value={form.email} onChange={set('email')}
                        placeholder="votre.email@exemple.com" required
                        className="w-full bg-white border-[1.5px] border-fog rounded-xl pl-11 pr-4 py-3 text-ink text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all" />
                    </div>
                    <p className="text-xs text-mist mt-1.5">
                      Si cet email est déjà enregistré, vous serez connecté directement. Sinon, un code OTP vous sera envoyé.
                    </p>
                  </div>

                  {/* Aide accordéon */}
                  <div className="bg-ghost/60 rounded-2xl overflow-hidden">
                    <button type="button" onClick={() => setHelp(h => !h)}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-mist hover:text-ink transition-colors">
                      <span>Aide — Où trouver ces informations ?</span>
                      <ChevronDown size={14} className={clsx('transition-transform duration-200', showHelp && 'rotate-180')} />
                    </button>
                    {showHelp && (
                      <div className="px-4 pb-4 flex flex-col gap-2 text-xs text-mist">
                        <p>• <strong className="text-ink">CIN</strong> : votre numéro de Carte d'Identité Nationale (8 chiffres)</p>
                        <p>• <strong className="text-ink">Nom / Prénom</strong> : exactement comme dans votre dossier SALIMA</p>
                        <p>• <strong className="text-ink">Email</strong> : adresse utilisée lors de votre préinscription, ou une nouvelle si c'est votre première connexion</p>
                        <p className="pt-1 text-fog">En cas de problème, contactez la scolarité de votre établissement.</p>
                      </div>
                    )}
                  </div>

                  <Btn type="submit" size="lg" loading={loading} className="w-full justify-center mt-1">
                    {loading ? 'Vérification en cours…' : <><span>Continuer</span><ArrowRight size={16}/></>}
                  </Btn>
                </form>
              )}

              {/* ÉTAPE 2 — OTP */}
              {step === 2 && (
                <form onSubmit={handleStep2} className="flex flex-col gap-5">

                  {/* Bandeau d'erreur générique */}
                  {globalError && (
                    <div className="flex items-start gap-3 bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3.5 animate-fade-in">
                      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} className="text-white"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-red-800 leading-tight">Code incorrect</p>
                        <p className="text-xs text-red-700 mt-1 leading-snug">{globalError}</p>
                      </div>
                      <button type="button" onClick={() => setGlobalError(null)}
                        className="text-red-400 hover:text-red-600 shrink-0 p-1">
                        <X size={14}/>
                      </button>
                    </div>
                  )}

                  <div className="bg-ghost/60 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                      <span className="font-display font-bold text-brand text-sm">
                        {(form.prenom_fr?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink text-sm">{form.prenom_fr} {form.nom_fr}</p>
                      <p className="text-xs text-mist font-mono">{form.mat_cin}</p>
                    </div>
                    <CheckCircle size={16} className="text-success shrink-0" />
                  </div>

                  <OtpInput value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} />

                  <p className="text-xs text-mist text-center -mt-1">
                    Code valable <strong className="text-ink">10 minutes</strong>. Vérifiez aussi vos spams.
                  </p>

                  <Btn type="submit" size="lg" loading={loading} disabled={form.code.length !== 6}
                    className="w-full justify-center">
                    {loading ? 'Vérification…' : <><span>Confirmer le code</span><ArrowRight size={15}/></>}
                  </Btn>

                  <div className="flex items-center justify-between pt-1">
                    <button type="button"
                      onClick={() => { setStep(1); setForm(f => ({ ...f, code: '' })) }}
                      className="text-sm text-mist hover:text-ink transition-colors">
                      ← Modifier mes infos
                    </button>
                    <button type="button" onClick={resendOtp} disabled={loading}
                      className="text-sm text-brand hover:underline disabled:opacity-40 font-medium">
                      Renvoyer le code
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Footer — aucun lien vers l'admin */}
          <p className="text-center text-xs text-white/20 mt-6">
            Portail réservé aux étudiants — ISI Ariana
          </p>
        </div>
      </div>
    </div>
  )
}
