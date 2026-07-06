import { ShieldCheck, Clock, Users, Laptop, FileCheck, AlertTriangle } from 'lucide-react'

const rules = [
  {
    icon: <Clock size={18}/>,
    title: 'Assiduite et ponctualite',
    text: "L'etudiant respecte les horaires des cours, travaux pratiques, examens et activites obligatoires de l'institut.",
  },
  {
    icon: <Users size={18}/>,
    title: 'Respect et discipline',
    text: "L'etudiant adopte un comportement respectueux envers les enseignants, le personnel administratif et les autres etudiants.",
  },
  {
    icon: <Laptop size={18}/>,
    title: 'Materiel et locaux',
    text: "Les salles, laboratoires, equipements informatiques et ressources pedagogiques doivent etre utilises avec soin.",
  },
  {
    icon: <FileCheck size={18}/>,
    title: 'Documents et informations',
    text: "Les informations declarees et les pieces justificatives fournies lors de l'inscription doivent etre exactes et authentiques.",
  },
  {
    icon: <AlertTriangle size={18}/>,
    title: 'Examens et securite',
    text: "L'etudiant respecte les consignes d'examen, de securite, d'acces aux locaux et toute decision disciplinaire applicable.",
  },
]

export default function ReglementInterne() {
  return (
    <div className="w-full max-w-none px-4 py-2 flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">
          Reglement interne
        </h1>
        <p className="text-mist mt-1 text-sm">
          Institut Superieur d'Informatique - regles a lire avant la soumission de l'inscription.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-amber-200 bg-amber-50">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldCheck size={18}/>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Engagement de l'etudiant</h2>
            <p className="text-xs text-mist mt-0.5">Ce texte est un exemple de reglement interne a adapter par l'administration.</p>
          </div>
        </header>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm leading-7 text-ink">
            En accedant a l'espace etudiant et en soumettant son dossier d'inscription, l'etudiant s'engage a respecter le reglement interne de l'institut, les consignes pedagogiques, administratives et disciplinaires, ainsi que les regles de bonne conduite au sein de l'etablissement.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.map(rule => (
              <div key={rule.title} className="rounded-xl border border-ghost bg-ghost/20 p-4">
                <div className="flex items-center gap-2 text-ink font-bold text-sm">
                  <span className="text-brand">{rule.icon}</span>
                  {rule.title}
                </div>
                <p className="text-sm text-mist leading-6 mt-2">{rule.text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-800 leading-6">
              Toute fausse declaration, fraude, falsification de document ou non-respect grave du reglement peut entrainer le rejet du dossier.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
