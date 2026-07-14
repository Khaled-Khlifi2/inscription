import { ShieldCheck, Clock, Users, AlertTriangle } from 'lucide-react'

const sections = [
  {
    icon: <Clock size={18}/>,
    title: 'I - الواجبات البيداغوجية',
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
            <p className="text-xs text-mist mt-0.5">النظام الداخلي للمعهد العالي للإعلامية</p>
          </div>
        </header>

        <div className="p-5 flex flex-col gap-4" dir="rtl" lang="ar">
          <p className="text-sm leading-7 text-ink text-right">
            إن تسجيل الطالب بالمؤسسة هو تعبير منه عن رغبته في الانتماء إليها لذلك يتعين عليه احترام جميع مقومات السلوك الحضاري طبقا لما يلي:
          </p>

          <div className="grid grid-cols-1 gap-3">
            {sections.map(section => (
              <div key={section.title} className="rounded-xl border border-ghost bg-ghost/20 p-4">
                <div className="flex items-center justify-end gap-2 text-ink font-bold text-sm">
                  {section.title}
                  <span className="text-brand">{section.icon}</span>
                </div>
                <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-mist leading-6 text-right">
                  {section.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-800 leading-6 text-right flex items-start justify-end gap-2">
              <span>
                و في صورة الإخلال بأحد هذه التعليمات يعرض الطالب نفسه إلى إجراءات تأديبية قد تصل إلى الطرد من المؤسسة.
              </span>
              <AlertTriangle size={18} className="mt-1 shrink-0"/>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
