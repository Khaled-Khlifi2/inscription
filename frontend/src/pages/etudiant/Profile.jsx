/**
 * Mon dossier — vue récapitulative professionnelle et complète.
 * Affiche tous les champs du profil étudiant (FR + AR), le statut
 * de l'inscription et les pièces jointes attachées.
 */
import { useEffect, useState } from 'react'
import { getMyProfile } from '../../services/etudiantApi'
import { PageLoader, Badge, Tabs, SectionHead } from '../../components/ui'
import {
  UserCircle, ClipboardCheck, Clock, XCircle,
  IdCard, User, GraduationCap, FileText, Phone, Mail, MapPin,
  Calendar, Heart, Globe, BookOpen, CreditCard, Image as ImageIcon,
  ShieldCheck, AlertCircle, FileQuestion, Fingerprint, Ticket, Tag,
} from 'lucide-react'
import clsx from 'clsx'

const ANNEE = '2025/2026'

// ── Sous-composants ───────────────────────────────────────────

function InfoCard({ icon, label, value, arabic, mono, capitalize }) {
  const empty = value == null || value === ''
  return (
    <div className="rounded-xl border border-ghost bg-white px-4 py-3 flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-mist">
        {icon && <span className="text-steel">{icon}</span>}
        {label}
      </span>
      {empty ? (
        <span className="text-sm text-fog italic">— Non renseigné —</span>
      ) : (
        <span
          dir={arabic ? 'rtl' : 'ltr'}
          className={clsx(
            'text-sm text-ink font-medium break-words',
            arabic && 'text-right',
            mono && 'font-mono',
            capitalize && 'capitalize'
          )}
        >
          {value}
        </span>
      )}
    </div>
  )
}

function GroupSection({ icon, title, children }) {
  return (
    <section className="rounded-2xl border border-ghost bg-white shadow-sm overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-3.5 border-b border-ghost bg-ghost/30">
        <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h3 className="font-display font-bold text-sm text-ink">{title}</h3>
      </header>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {children}
      </div>
    </section>
  )
}

function StatutInscription({ insc, isComplete }) {
  if (!insc) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
        <FileQuestion size={11}/> Aucune inscription cette année
      </span>
    )
  }
  if (insc.statut === 'brouillon') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
        <FileQuestion size={11}/> Brouillon — non soumis
      </span>
    )
  }
  if (insc.statut === 'validee') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ClipboardCheck size={11}/> Inscription validée
      </span>
    )
  }
  if (insc.statut === 'soumis') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <Clock size={11}/> Soumis — en attente de validation
      </span>
    )
  }
  if (insc.statut === 'en_attente') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={11}/> Re-soumis — en attente de validation
      </span>
    )
  }
  if (insc.statut === 'rejetee') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
        <XCircle size={11}/> Dossier refusé
      </span>
    )
  }
  return null
}

// ── Page principale ──────────────────────────────────────────
export default function EtudiantProfile() {
  const [data, setData] = useState(null)
  const [tab, setTab]   = useState('identity')

  useEffect(() => { getMyProfile().then(r => setData(r.data)) }, [])

  if (!data) return <PageLoader />

  const insc = data.inscriptions?.find(i => i.annee_universitaire === ANNEE) || null
  const sexeLabel = data.sexe === 'M' ? 'Masculin' : data.sexe === 'F' ? 'Féminin' : data.sexe

  return (
    <div>
      <SectionHead
        title="Mon dossier"
        sub={`Année universitaire ${ANNEE} — vos informations académiques et personnelles`}
      />

      {/* ── Carte profil principale ─────────────────────── */}
      <div className="bg-gradient-to-br from-white to-brand/5 rounded-2xl border border-ghost shadow-sm p-7 mb-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 bg-brand/10 rounded-2xl flex items-center justify-center shrink-0">
            <UserCircle size={42} className="text-brand"/>
          </div>
          <div className="flex-1 min-w-[260px]">
            <h2 className="font-display text-2xl font-bold text-ink">
              {data.nom_fr} {data.prenom_fr}
            </h2>
            {(data.nom_ar || data.prenom_ar) && (
              <p className="text-mist mt-1 text-lg" dir="rtl">{data.nom_ar} {data.prenom_ar}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <code className="bg-ghost text-ink-muted text-xs px-2.5 py-1 rounded-lg font-mono font-bold">
                {data.mat_cin}
              </code>
              {data.num_inscription && (
                <code className="bg-ghost text-ink-muted text-xs px-2.5 py-1 rounded-lg font-mono">
                  N° {data.num_inscription}
                </code>
              )}
              {data.cfil && (
                <Badge color="blue">{data.cfil}{data.niveau?.libelle ? ` · ${data.niveau.libelle}` : ''}</Badge>
              )}
              <StatutInscription insc={insc} isComplete={data.is_inscription_complete}/>
              {data.email_verified
                ? <Badge color="green"><ShieldCheck size={11} className="inline mr-1"/>Email vérifié</Badge>
                : <Badge color="amber"><AlertCircle size={11} className="inline mr-1"/>Email non vérifié</Badge>}
            </div>
            {insc?.statut === 'rejetee' && insc.message_rejet && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                <p className="font-bold mb-0.5">Motif du refus :</p>
                <p>{insc.message_rejet}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Onglets ─────────────────────────────────────── */}
      <div className="mb-5">
        <Tabs active={tab} onChange={setTab} tabs={[
          { value: 'identity',  label: 'Identité civile' },
          { value: 'contact',   label: 'Coordonnées' },
          { value: 'admin',     label: 'Administratif' },
          { value: 'academic',  label: 'Cursus académique' },
          { value: 'documents', label: 'Pièces jointes' },
        ]}/>
      </div>

      {/* ── Contenu des onglets ─────────────────────────── */}
      {tab === 'identity' && (
        <div className="flex flex-col gap-5">
          <GroupSection icon={<IdCard size={18}/>} title="Identifiants administratifs">
            <InfoCard icon={<Fingerprint size={11}/>} label="Matricule / CIN"  value={data.mat_cin}         mono/>
            <InfoCard icon={<Ticket size={11}/>}      label="N° d'inscription" value={data.num_inscription} mono/>
          </GroupSection>

          <GroupSection icon={<User size={18}/>} title="Identité civile">
            <InfoCard icon={<User size={11}/>}    label="Nom (FR)"            value={data.nom_fr}/>
            <InfoCard icon={<User size={11}/>}    label="Prénom (FR)"         value={data.prenom_fr}/>
            <InfoCard icon={<Globe size={11}/>}   label="Sexe"                value={sexeLabel}/>
            <InfoCard icon={<User size={11}/>}    label="اللقب (AR)"           value={data.nom_ar}    arabic/>
            <InfoCard icon={<User size={11}/>}    label="الاسم (AR)"           value={data.prenom_ar} arabic/>
            <InfoCard icon={<Heart size={11}/>}   label="Situation familiale" value={data.situation_familiale}/>
            <InfoCard icon={<Calendar size={11}/>} label="Date de naissance"  value={data.date_naissance}/>
            <InfoCard icon={<MapPin size={11}/>}  label="Lieu de naissance (FR)" value={data.lieu_naiss_fr}/>
            <InfoCard icon={<MapPin size={11}/>}  label="مكان الولادة (AR)"     value={data.lieu_naiss_ar} arabic/>
          </GroupSection>
        </div>
      )}

      {tab === 'contact' && (
        <GroupSection icon={<Phone size={18}/>} title="Coordonnées">
          <InfoCard icon={<Mail size={11}/>}     label="Adresse email"       value={data.email}/>
          <InfoCard icon={<Phone size={11}/>}    label="Téléphone portable"  value={data.telephone_portable}/>
          <InfoCard icon={<Phone size={11}/>}    label="Téléphone fixe"      value={data.telephone_fixe}/>
          <InfoCard icon={<MapPin size={11}/>}   label="Adresse (FR)"        value={data.adresse_fr}/>
          <InfoCard icon={<MapPin size={11}/>}   label="العنوان (AR)"          value={data.adresse_ar} arabic/>
        </GroupSection>
      )}

      {tab === 'admin' && (
        <GroupSection icon={<FileText size={18}/>} title="Données administratives">
          <InfoCard icon={<Globe size={11}/>}      label="Code gouvernorat" value={data.code_gouvernorat} mono/>
          <InfoCard icon={<BookOpen size={11}/>}   label="Type de BAC"      value={data.code_type_bac}/>
          <InfoCard icon={<CreditCard size={11}/>} label="N° CNSS"          value={data.num_cnss} mono/>
          <InfoCard icon={<IdCard size={11}/>}     label="N° Passeport"     value={data.passeport} mono/>
        </GroupSection>
      )}

      {tab === 'academic' && (
        <GroupSection icon={<GraduationCap size={18}/>} title="Cursus académique">
          <InfoCard icon={<GraduationCap size={11}/>} label="Niveau d'études" value={data.niveau?.libelle}/>
          <InfoCard icon={<Tag size={11}/>}           label="Code filière"    value={data.cfil} mono/>
          <InfoCard icon={<BookOpen size={11}/>}      label="Filière (FR)"    value={data.lib_filiere}/>
          <InfoCard icon={<BookOpen size={11}/>}      label="اسم الشعبة (AR)"  value={data.lib_filiere_ar} arabic/>
          <InfoCard icon={<Calendar size={11}/>}      label="Année universitaire" value={ANNEE}/>
        </GroupSection>
      )}

      {tab === 'documents' && (
        <section className="rounded-2xl border border-ghost bg-white shadow-sm overflow-hidden">
          <header className="flex items-center gap-3 px-5 py-3.5 border-b border-ghost bg-ghost/30">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <FileText size={18}/>
            </div>
            <h3 className="font-display font-bold text-sm text-ink">Pièces jointes au dossier</h3>
          </header>
          <div className="p-5">
            {!insc?.pieces_jointes?.length ? (
              <div className="text-center py-12 text-mist">
                <FileQuestion size={32} className="mx-auto mb-3 text-fog"/>
                <p className="text-sm">Aucune pièce jointe pour cette année universitaire.</p>
                <p className="text-xs mt-1 text-fog">
                  Rendez-vous sur la page <strong>Inscription</strong> pour téléverser votre photo et votre CIN.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insc.pieces_jointes.map(pj => (
                  <li key={pj.id} className={clsx(
                    'flex items-center gap-3 rounded-xl border px-4 py-3',
                    pj.statut === 'refusee' ? 'border-red-200 bg-red-50' : 'border-ghost bg-ghost/30'
                  )}>
                    <div className="w-10 h-10 rounded-xl bg-white border border-ghost flex items-center justify-center shrink-0">
                      {pj.type_document === 'photo' ? <ImageIcon size={16} className="text-brand"/>
                        : pj.type_document === 'cin' ? <IdCard size={16} className="text-brand"/>
                        : <FileText size={16} className="text-brand"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{pj.nom_fichier}</p>
                      <p className="text-[0.7rem] text-mist mt-0.5 capitalize">
                        {pj.type_document} · {(pj.taille_octets / 1024).toFixed(0)} Ko
                      </p>
                      {pj.statut === 'refusee' && pj.motif_refus && (
                        <p className="mt-1 text-[0.72rem] text-red-700 leading-relaxed">
                          Motif du refus : {pj.motif_refus}
                        </p>
                      )}
                    </div>
                    {pj.statut === 'refusee' && <Badge color="red">Refusee</Badge>}
                    {pj.type_document === 'cin' && (
                      pj.ocr_verified
                        ? <Badge color="green">OCR ✓</Badge>
                        : <Badge color="amber">OCR ⚠</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
