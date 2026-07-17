import { AlertTriangle, BookOpenCheck, CheckCircle2, Clock, IdCard, ShieldCheck, Users } from 'lucide-react'

const sections = [
  {
    icon: <Clock size={18}/>,
    title: 'I - الواجبات البيداغوجية',
    accent: 'blue',
    items: [
      'الالتزام بضرورة الحضور الفعلي لجميع الدروس بمختلف أنواعها (دروس نظرية، أشغال مسيّرة، وأشغال تطبيقية).',
      'ضرورة الإطلاع بصورة منتظمة على كل المعلقات الخاصة بسير الدروس وتواريخ تنظيم الامتحانات وغيرها من الإعلانات كما يجب على الطالب الاطلاع بصفة دورية على موقع واب المؤسسة www.isi.rnu.tn.',
      'الالتزام باحترام التراتيب العامة للامتحانات وكل مخالفة تعرض مرتكبيها للإجراءات التأديبية المعمول بها.',
      'يمكن للطالب القيام بمطلب في سحب التسجيل لأسباب اجتماعية أو شخصية في مدة أقصاها شهر من تاريخ انطلاق الدروس.',
    ],
  },
  {
    icon: <Users size={18}/>,
    title: 'II - السلوك و المظهر و الهندام',
    accent: 'emerald',
    items: [
      'احترام إطار التدريس داخل الفصل وخارجه.',
      'احترام المسؤولين عن المؤسسة وكل العاملين بها.',
      'احترام مبدأ حرية الدرس والامتناع عن تعطيله لأي سبب من الأسباب.',
      'الامتناع عن كل ما من شأنه أن يحدث ضرر بمكاسب المؤسسة مهما كان نوعها.',
      'الامتناع عن الكتابة على جميع جدران مباني المؤسسة وطاولات الدراسة وغيرها والمحافظة على نظافة المعهد.',
      'الالتزام بالآداب العامة وكل ما من شأنه المساس بالأخلاق الحميدة والابتعاد عن جميع أشكال العنف اللفظي والمادي وغيرها. كل إخلال يعرض صاحبه إلى تعليق التسجيل إلى حين البت في وضعيته.',
      'الامتناع عن ارتداء اللباس الخليع والشاذ.',
      'الامتناع عن ارتداء أزياء ذات إيحاءات ودلالات طائفية وعن كل مظهر من مظاهر التطرف.',
      'عدم تنظيم اجتماع داخل المؤسسة ما لم يكن مرخصا فيه كتابيا من قبل الكاتب العام أو مدير المؤسسة.',
    ],
  },
]

const accentClasses = {
  blue: {
    icon: 'bg-blue-100 text-blue-700',
    border: 'border-blue-100',
    title: 'text-blue-800',
    marker: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-100',
    title: 'text-emerald-800',
    marker: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
}

export default function ReglementInterne() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-4 md:py-6 flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-brand/15 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
        <div className="px-5 py-6 md:px-7 md:py-7 flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <ShieldCheck size={26}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
                <BookOpenCheck size={13}/>
                Lecture obligatoire
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 size={13}/>
                Avant soumission
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">
              Reglement interne
            </h1>
            <p className="text-mist mt-1 text-sm">
              Institut Superieur d'Informatique - regles a lire et accepter avant la soumission de l'inscription.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 rounded-2xl bg-ghost/50 border border-ghost px-4 py-3 text-sm text-mist">
            <IdCard size={17} className="text-brand"/>
            <span className="font-semibold text-ink">Espace etudiant</span>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-ghost shadow-sm overflow-hidden">
        <header className="px-5 py-4 md:px-6 border-b border-ghost bg-gradient-to-l from-brand/10 via-white to-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Engagement de l'etudiant</h2>
              <p className="text-xs text-mist mt-0.5">النظام الداخلي للمعهد العالي للإعلامية</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white border border-brand/15 text-brand flex items-center justify-center shrink-0">
              <ShieldCheck size={19}/>
            </div>
          </div>
        </header>

        <div className="p-5 md:p-6 flex flex-col gap-5" dir="rtl" lang="ar">
          <div className="rounded-2xl border border-brand/10 bg-brand/5 px-4 py-4">
            <p className="text-[0.95rem] leading-8 text-ink text-right">
              إن تسجيل الطالب بالمؤسسة هو تعبير منه عن رغبته في الانتماء إليها لذلك يتعين عليه احترام جميع مقومات السلوك الحضاري طبقا لما يلي:
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {sections.map(section => {
              const colors = accentClasses[section.accent]
              return (
                <article key={section.title} className={`rounded-2xl border ${colors.border} bg-white p-4 md:p-5 shadow-sm`}>
                  <div className="flex items-center justify-end gap-3 pb-3 border-b border-ghost">
                    <h3 className={`text-base font-bold ${colors.title}`}>{section.title}</h3>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                      {section.icon}
                    </span>
                  </div>
                  <ol className="mt-4 space-y-3 text-right">
                    {section.items.map((item, index) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 text-xs font-black ${colors.marker}`}>
                          {index + 1}
                        </span>
                        <span className="text-sm md:text-[0.95rem] text-steel leading-7 flex-1">{item}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              )
            })}
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <div className="flex items-start justify-end gap-3">
              <p className="text-sm md:text-[0.95rem] text-red-800 leading-7 text-right flex-1">
                و في صورة الإخلال بأحد هذه التعليمات يعرض الطالب نفسه إلى إجراءات تأديبية قد تصل إلى الطرد من المؤسسة.
              </p>
              <span className="w-9 h-9 rounded-xl bg-white border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={18}/>
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
