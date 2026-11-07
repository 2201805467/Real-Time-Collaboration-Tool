import React, { useEffect } from 'react';
import { Copy, Link, Trash2, UserPlus, X } from 'lucide-react';

function inviteUrl(token) {
  return `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
}

export default function ShareBoardDialog({
  boardTitle,
  invites,
  isLoading,
  isCreating,
  revokingInviteId,
  error,
  notice,
  onClose,
  onCreate,
  onCopy,
  onRevoke
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="share-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
        <header>
          <div className="share-dialog-heading">
            <span><Link size={20} /></span>
            <div>
              <h2 id="share-dialog-title">مشاركة المشروع</h2>
              <p>{boardTitle}</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق نافذة المشاركة"><X size={19} /></button>
        </header>

        <div className="share-dialog-intro">
          <div>
            <strong>دعوة عضو جديد</strong>
            <p>كل رابط صالح لمدة 7 أيام. يمكنك إلغاؤه في أي وقت.</p>
          </div>
          <button type="button" onClick={onCreate} disabled={isCreating}>
            <UserPlus size={17} />
            {isCreating ? 'جاري الإنشاء...' : 'إنشاء رابط دعوة'}
          </button>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-success">{notice}</p> : null}

        <div className="share-invites-header">
          <h3>روابط الدعوة النشطة</h3>
          <span>{invites.length}</span>
        </div>

        <div className="share-invites-list">
          {isLoading ? (
            <p className="empty-state">جاري تحميل روابط الدعوة...</p>
          ) : invites.length === 0 ? (
            <p className="empty-state">لا توجد روابط نشطة. أنشئ رابطاً لدعوة أعضاء الفريق.</p>
          ) : invites.map((invite) => {
            const url = inviteUrl(invite.token);
            return (
              <article key={invite.id}>
                <div>
                  <input readOnly value={url} aria-label="رابط الدعوة" />
                  <small>ينتهي في {new Date(invite.expiresAt).toLocaleString('ar')}</small>
                </div>
                <button type="button" className="secondary-button" onClick={() => onCopy(url)}>
                  <Copy size={16} /> نسخ
                </button>
                <button
                  type="button"
                  className="icon-danger-button"
                  onClick={() => onRevoke(invite.id)}
                  disabled={revokingInviteId === invite.id}
                  aria-label="إلغاء رابط الدعوة"
                  title="إلغاء الرابط"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
