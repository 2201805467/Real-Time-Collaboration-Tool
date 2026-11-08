import React, { useEffect } from 'react';
import { FileWarning, Save, X } from 'lucide-react';

export default function UnsavedChangesDialog({ isSaving, onCancel, onDiscard, onSave }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSaving) onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onCancel();
    }}>
      <section className="confirm-dialog unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description">
        <button type="button" className="confirm-dialog-close" onClick={onCancel} disabled={isSaving} aria-label="إغلاق"><X size={19} /></button>
        <span className="confirm-dialog-icon unsaved"><FileWarning size={27} /></span>
        <div className="confirm-dialog-copy">
          <span className="confirm-dialog-label">تغييرات غير محفوظة</span>
          <h2 id="unsaved-title">هل تريد مغادرة تفاصيل البطاقة؟</h2>
          <p id="unsaved-description">أجريت تغييرات لم تُحفظ بعد. يمكنك حفظها أولًا أو تجاهلها والمتابعة.</p>
        </div>
        <div className="confirm-dialog-actions unsaved-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>البقاء هنا</button>
          <button type="button" className="discard-button" onClick={onDiscard} disabled={isSaving}>تجاهل التغييرات</button>
          <button type="button" onClick={onSave} disabled={isSaving}><Save size={17} />{isSaving ? 'جاري الحفظ...' : 'حفظ والمتابعة'}</button>
        </div>
      </section>
    </div>
  );
}
