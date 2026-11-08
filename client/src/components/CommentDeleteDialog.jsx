import React, { useEffect } from 'react';
import { AlertTriangle, MessageSquare, Trash2, X } from 'lucide-react';

export default function CommentDeleteDialog({ comment, isDeleting, onCancel, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeleting) onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isDeleting) onCancel();
    }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="comment-delete-title" aria-describedby="comment-delete-description">
        <button type="button" className="confirm-dialog-close" onClick={onCancel} disabled={isDeleting} aria-label="إغلاق"><X size={19} /></button>
        <span className="confirm-dialog-icon"><AlertTriangle size={27} /></span>
        <div className="confirm-dialog-copy">
          <span className="confirm-dialog-label">تأكيد الحذف</span>
          <h2 id="comment-delete-title">حذف هذا التعليق؟</h2>
          <p id="comment-delete-description">سيختفي التعليق من البطاقة نهائيًا، ولا يمكن التراجع عن هذه العملية.</p>
        </div>
        <div className="confirm-dialog-file confirm-dialog-comment">
          <span><MessageSquare size={18} /></span>
          <p>{comment.body}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isDeleting}>إلغاء</button>
          <button type="button" className="confirm-delete-button" onClick={onConfirm} disabled={isDeleting}>
            <Trash2 size={17} />{isDeleting ? 'جاري الحذف...' : 'حذف التعليق'}
          </button>
        </div>
      </section>
    </div>
  );
}
