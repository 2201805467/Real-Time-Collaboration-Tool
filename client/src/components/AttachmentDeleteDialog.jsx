import React, { useEffect } from 'react';
import { AlertTriangle, Paperclip, Trash2, X } from 'lucide-react';

export default function AttachmentDeleteDialog({ attachment, isDeleting, onCancel, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeleting) onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onCancel();
      }}
    >
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="attachment-delete-title" aria-describedby="attachment-delete-description">
        <button type="button" className="confirm-dialog-close" onClick={onCancel} disabled={isDeleting} aria-label="إغلاق"><X size={19} /></button>
        <span className="confirm-dialog-icon"><AlertTriangle size={27} /></span>
        <div className="confirm-dialog-copy">
          <span className="confirm-dialog-label">تأكيد الحذف</span>
          <h2 id="attachment-delete-title">حذف هذا المرفق؟</h2>
          <p id="attachment-delete-description">سيتم حذف الملف نهائيًا من البطاقة، ولا يمكن التراجع عن هذه العملية.</p>
        </div>
        <div className="confirm-dialog-file">
          <span><Paperclip size={18} /></span>
          <strong title={attachment.name}>{attachment.name}</strong>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isDeleting}>إلغاء</button>
          <button type="button" className="confirm-delete-button" onClick={onConfirm} disabled={isDeleting}>
            <Trash2 size={17} />{isDeleting ? 'جاري الحذف...' : 'حذف المرفق'}
          </button>
        </div>
      </section>
    </div>
  );
}
