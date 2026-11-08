import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock3, Download, ExternalLink, FileText, ListChecks, Paperclip, Play, RefreshCw, RotateCcw, Search, Send, Trash2, UserRound, XCircle } from 'lucide-react';
import AttachmentDeleteDialog from '../components/AttachmentDeleteDialog.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { myTasksApi } from '../api/myTasksApi.js';

const fileFeaturesEnabled = false;

const statusLabels = {
  todo: 'لم تبدأ',
  in_progress: 'قيد التنفيذ',
  review: 'بانتظار المراجعة',
  changes_requested: 'مطلوب تعديل',
  done: 'مكتملة'
};

const filters = ['all', 'todo', 'in_progress', 'review', 'changes_requested', 'done'];

function TaskAttachments({ task, token, canChange, busyKey, onUpload, onDownload, onAskDelete }) {
  return (
    <section className="my-task-files">
      <div className="my-task-files-heading"><span><Paperclip size={16} /> ملفات التسليم</span><strong>{task.attachments.length}</strong></div>
      {task.attachments.length ? (
        <div className="my-task-file-list">
          {task.attachments.map((attachment) => (
            <div key={attachment.id} className="my-task-file">
              <FileText size={17} />
              <span><strong title={attachment.name}>{attachment.name}</strong><small>{attachment.uploaderName || 'مستخدم'}</small></span>
              <button type="button" onClick={() => onDownload(task, attachment)} title="تنزيل"><Download size={16} /></button>
              {canChange ? <button type="button" className="delete" onClick={() => onAskDelete(task, attachment)} title="حذف"><Trash2 size={16} /></button> : null}
            </div>
          ))}
        </div>
      ) : <small className="my-task-no-files">لم تُرفع ملفات لهذه المهمة بعد.</small>}
      {canChange ? (
        <label className="my-task-upload">
          <Paperclip size={16} />{busyKey === `upload:${task.id}` ? 'جاري الرفع...' : 'إرفاق ملف العمل'}
          <input type="file" disabled={Boolean(busyKey)} onChange={(event) => onUpload(task, event.target.files?.[0], event)} accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json,application/zip,.doc,.docx,.xls,.xlsx" />
        </label>
      ) : null}
    </section>
  );
}

export default function MyTasksPage({ token, refreshKey, onOpenCard }) {
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [reviewTasks, setReviewTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('assigned');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadTasks = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      const data = await myTasksApi.getAll(token);
      setAssignedTasks(data.assignedTasks || []);
      setReviewTasks(data.reviewTasks || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { loadTasks(); }, [loadTasks, refreshKey]);

  const sourceTasks = activeTab === 'review' ? reviewTasks : assignedTasks;
  const visibleTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar');
    return sourceTasks.filter((task) => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesSearch = !query || [task.text, task.cardTitle, task.boardTitle, task.managerName]
        .some((value) => String(value || '').toLocaleLowerCase('ar').includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [sourceTasks, statusFilter, search]);

  async function runAction(key, action) {
    setError('');
    setBusyKey(key);
    try {
      await action();
      await loadTasks();
      return true;
    } catch (actionError) {
      const messages = {
        'A review note is required when requesting changes': 'اكتب ملاحظة توضّح التعديلات المطلوبة.',
        'Attachment must not exceed 5 MB': 'يجب ألا يتجاوز حجم الملف 5 ميجابايت.',
        'This attachment type is not supported': 'نوع هذا الملف غير مدعوم.'
      };
      setError(messages[actionError.message] || actionError.message);
      return false;
    } finally {
      setBusyKey('');
    }
  }

  async function updateStatus(task, status) {
    const note = reviewNotes[task.id] || '';
    const updated = await runAction(`status:${task.id}`, () => myTasksApi.updateStatus(task, status, note, token));
    if (updated) setReviewNotes((current) => ({ ...current, [task.id]: '' }));
  }

  async function uploadFile(task, file, event) {
    if (!file) return;
    await runAction(`upload:${task.id}`, () => myTasksApi.uploadAttachment(task, file, token));
    event.target.value = '';
  }

  async function downloadFile(task, attachment) {
    await runAction(`download:${attachment.id}`, () => myTasksApi.downloadAttachment(task, attachment, token));
  }

  async function confirmDeleteFile() {
    if (!deleteTarget) return;
    const deleted = await runAction(`delete:${deleteTarget.attachment.id}`, () => myTasksApi.removeAttachment(deleteTarget.task, deleteTarget.attachment.id, token));
    if (deleted) setDeleteTarget(null);
  }

  return (
    <section className="my-tasks-page">
      <header className="my-tasks-hero">
        <div><p className="eyebrow">مساحة التنفيذ الشخصية</p><h2>مهامي ومراجعاتي</h2><p>ابدأ العمل، ارفع ملفات التسليم، ثم أرسل المهمة إلى المسؤول للمراجعة والاعتماد.</p></div>
        <button type="button" className="secondary-button" onClick={loadTasks} disabled={isLoading}><RefreshCw size={17} /> تحديث</button>
      </header>

      <div className="my-tasks-summary">
        <article><ListChecks size={20} /><span>المسندة إليك</span><strong>{assignedTasks.length}</strong></article>
        <article><Clock3 size={20} /><span>قيد التنفيذ</span><strong>{assignedTasks.filter((task) => ['in_progress', 'changes_requested'].includes(task.status)).length}</strong></article>
        <article><Send size={20} /><span>بانتظار المراجعة</span><strong>{assignedTasks.filter((task) => task.status === 'review').length}</strong></article>
        <article><CheckCircle2 size={20} /><span>مكتملة</span><strong>{assignedTasks.filter((task) => task.status === 'done').length}</strong></article>
      </div>

      <div className="my-tasks-controls">
        <div className="my-tasks-tabs">
          <button type="button" className={activeTab === 'assigned' ? 'active' : ''} onClick={() => setActiveTab('assigned')}>مهامي <span>{assignedTasks.length}</span></button>
          <button type="button" className={activeTab === 'review' ? 'active' : ''} onClick={() => setActiveTab('review')}>بانتظار مراجعتي <span>{reviewTasks.length}</span></button>
        </div>
        <label className="my-tasks-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في المهام أو المشاريع..." /></label>
      </div>

      {activeTab === 'assigned' ? <div className="my-tasks-filters">{filters.map((filter) => <button key={filter} type="button" className={statusFilter === filter ? 'active' : ''} onClick={() => setStatusFilter(filter)}>{filter === 'all' ? 'الكل' : statusLabels[filter]}</button>)}</div> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {isLoading ? <p className="empty-state">جاري تحميل المهام...</p> : visibleTasks.length ? (
        <div className="my-tasks-list">
          {visibleTasks.map((task) => {
            const isReviewTab = activeTab === 'review';
            const canChangeFiles = isReviewTab || !['review', 'done'].includes(task.status);
            return (
              <article key={`${task.cardId}:${task.id}`} className={`my-task-card status-${task.status}`}>
                <div className="my-task-card-head">
                  <div><span className={`my-task-status ${task.status}`}>{statusLabels[task.status]}</span><span className="my-task-project">{task.boardTitle} · {task.cardTitle}</span></div>
                  <button type="button" className="icon-plain-button" onClick={() => onOpenCard(task.boardId, task.cardId)} title="فتح البطاقة"><ExternalLink size={18} /></button>
                </div>
                <h3>{task.text}</h3>
                <div className="my-task-context">
                  <span><UserAvatar src={task.managerAvatarUrl} name={task.managerName || 'غير معيّن'} /> <UserRound size={14} /> المسؤول: {task.managerName || 'غير معيّن'}</span>
                  {task.dueDate ? <span><Calendar size={15} /> {task.dueDate}</span> : null}
                  <span>{task.columnTitle}</span>
                </div>
                {task.reviewNote ? <div className="my-task-review-note"><strong>ملاحظة المراجع</strong><p>{task.reviewNote}</p></div> : null}

                {fileFeaturesEnabled ? <TaskAttachments task={task} token={token} canChange={canChangeFiles} busyKey={busyKey} onUpload={uploadFile} onDownload={downloadFile} onAskDelete={(selectedTask, attachment) => setDeleteTarget({ task: selectedTask, attachment })} /> : null}

                {isReviewTab ? (
                  <div className="my-task-review-actions">
                    <textarea value={reviewNotes[task.id] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="اكتب ملاحظة عند طلب التعديل..." rows="2" />
                    <button type="button" className="request-changes-button" disabled={Boolean(busyKey)} onClick={() => updateStatus(task, 'changes_requested')}><XCircle size={17} /> طلب تعديل</button>
                    <button type="button" disabled={Boolean(busyKey)} onClick={() => updateStatus(task, 'done')}><CheckCircle2 size={17} /> اعتماد وإنهاء</button>
                  </div>
                ) : (
                  <div className="my-task-member-actions">
                    {task.status === 'todo' ? <button type="button" disabled={Boolean(busyKey)} onClick={() => updateStatus(task, 'in_progress')}><Play size={17} /> بدء العمل</button> : null}
                    {task.status === 'changes_requested' ? <button type="button" disabled={Boolean(busyKey)} onClick={() => updateStatus(task, 'in_progress')}><RotateCcw size={17} /> بدء التعديلات</button> : null}
                    {task.status === 'in_progress' ? <button type="button" disabled={Boolean(busyKey)} onClick={() => updateStatus(task, 'review')}><Send size={17} /> إرسال للمراجعة</button> : null}
                    {task.status === 'review' ? <span className="my-task-waiting"><Clock3 size={16} /> أُرسلت للمسؤول وبانتظار قراره.</span> : null}
                    {task.status === 'done' ? <span className="my-task-approved"><CheckCircle2 size={16} /> تم اعتماد هذه المهمة.</span> : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : <div className="empty-state"><ListChecks size={30} /><strong>لا توجد مهام في هذا القسم</strong><span>{activeTab === 'review' ? 'ستظهر هنا المهام التي يرسلها الأعضاء للمراجعة.' : 'ستظهر هنا المهام التي يسندها إليك المسؤول.'}</span></div>}

      {fileFeaturesEnabled && deleteTarget ? <AttachmentDeleteDialog attachment={deleteTarget.attachment} isDeleting={busyKey === `delete:${deleteTarget.attachment.id}`} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteFile} /> : null}
    </section>
  );
}
