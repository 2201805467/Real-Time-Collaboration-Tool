import { CheckCircle2, Columns3, Server } from 'lucide-react';

function App() {
  return (
    <main className="app-shell">
      <section className="intro">
        <div className="mark">
          <Columns3 size={34} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Real-Time Collaboration Tool</p>
          <h1>منصة إدارة مهام تعاونية</h1>
          <p className="lede">
            تم تجهيز هيكل المشروع الأساسي. الخطوة القادمة ستكون ربط الواجهة
            بالسيرفر ثم إضافة التحديثات الفورية.
          </p>
        </div>
      </section>

      <section className="status-grid" aria-label="Project setup status">
        <article>
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <h2>React جاهز</h2>
            <p>واجهة أولية تعمل عبر Vite.</p>
          </div>
        </article>
        <article>
          <Server size={22} aria-hidden="true" />
          <div>
            <h2>Express جاهز</h2>
            <p>API أولي على المسار /api/health.</p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default App;
