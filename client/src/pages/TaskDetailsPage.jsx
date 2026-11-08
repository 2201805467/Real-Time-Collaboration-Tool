import React, { useMemo, useState } from 'react';
import { Activity, ArrowLeftRight, Calendar, CheckCircle2, Download, FileText, Flag, ListChecks, MessageSquare, Paperclip, Pencil, PlusCircle, Search, Send, Trash2, UserRound } from 'lucide-react';
import AttachmentDeleteDialog from '../components/AttachmentDeleteDialog.jsx';
import CardDeleteDialog from '../components/CardDeleteDialog.jsx';
import CommentDeleteDialog from '../components/CommentDeleteDialog.jsx';
import UserAvatar from '../components/UserAvatar.jsx';

const activityIcons = {
  created: PlusCircle,
  updated: Pencil,
  moved: ArrowLeftRight,
  commented: MessageSquare,
  comment_updated: Pencil,
  comment_deleted: Trash2,
  attachment_added: Paperclip,
  attachment_deleted: Trash2,
  subtask_submitted: Send,
  subtask_approved: CheckCircle2,
  subtask_changes_requested: Pencil,
  subtask_status_updated: ArrowLeftRight,
  subtask_attachment_added: Paperclip,
  subtask_attachment_deleted: Trash2
};

function formatFileSize(size) {
  if (size < 1024) return `${size} بايت`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} كيلوبايت`;
  return `${(size / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

function activityDescription(activity) {
  if (activity.action === 'created') return 'أنشأ البطاقة';
  if (activity.action === 'updated') {
    const fieldLabels = {
      title: 'العنوان',
      description: 'الوصف',
      dueDate: 'تاريخ الاستحقاق',
      assignee: 'المسؤول',
      priority: 'الأولوية',
      tags: 'التصنيفات',
      checklist: 'المهام الفرعية'
    };
    const changedFields = (activity.metadata?.changedFields || [])
      .map((field) => fieldLabels[field])
      .filter(Boolean);
    return changedFields.length
      ? `حدّث ${changedFields.join('، ')}`
      : 'حدّث تفاصيل البطاقة أو مهامها';
  }
  if (activity.action === 'moved') {
    return activity.metadata?.columnTitle
      ? `نقل البطاقة إلى «${activity.metadata.columnTitle}»`
      : 'نقل البطاقة إلى عمود آخر';
  }
  if (activity.action === 'commented') return 'أضاف تعليقاً جديداً';
  if (activity.action === 'comment_updated') return 'عدّل تعليقاً';
  if (activity.action === 'comment_deleted') return 'حذف تعليقاً';
  if (activity.action === 'attachment_added') return `أضاف المرفق «${activity.metadata?.fileName || 'ملف'}»`;
  if (activity.action === 'attachment_deleted') return `حذف المرفق «${activity.metadata?.fileName || 'ملف'}»`;
  if (activity.action === 'subtask_submitted') return `أرسل المهمة «${activity.metadata?.subtaskTitle || 'مهمة فرعية'}» للمراجعة`;
  if (activity.action === 'subtask_approved') return `اعتمد المهمة «${activity.metadata?.subtaskTitle || 'مهمة فرعية'}»`;
  if (activity.action === 'subtask_changes_requested') return `طلب تعديلات على المهمة «${activity.metadata?.subtaskTitle || 'مهمة فرعية'}»`;
  if (activity.action === 'subtask_status_updated') return `حدّث حالة المهمة «${activity.metadata?.subtaskTitle || 'مهمة فرعية'}»`;
  if (activity.action === 'subtask_attachment_added') return `أرفق «${activity.metadata?.fileName || 'ملف'}» بالمهمة «${activity.metadata?.subtaskTitle || 'مهمة فرعية'}»`;
  if (activity.action === 'subtask_attachment_deleted') return `حذف مرفقًا من المهمة «${activity.metadata?.subtaskTitle || 'مهمة فرعية'}»`;
  return 'أجرى تغييراً على البطاقة';
}

function TaskDetailsPage({
  selectedCardId,
  selectedCard,
  priorityLabels,
  cardDetailsForm,
  boardMembers,
  managerMembers,
  canEditSelectedCardDetails,
  canEditSelectedSubtasks,
  canDeleteSelectedCard,
  canSaveSelectedCard,
  isDeletingCard,
  isLoadingCardDetails,
  isSavingCardDetails,
  cardDetailsError,
  comments,
  attachments,
  cardActivity,
  columns,
  commentBody,
  isAddingComment,
  updatingCommentId,
  deletingCommentId,
  isUploadingAttachment,
  deletingAttachmentId,
  user,
  setCardDetailsForm,
  setCommentBody,
  handleDeleteCard,
  closeCard,
  addTag,
  removeTag,
  addChecklistItem,
  updateChecklistItem,
  removeChecklistItem,
  handleSaveCardDetails,
  handleAddComment,
  handleUpdateComment,
  handleDeleteComment,
  handleUploadAttachment,
  handleDownloadAttachment,
  handleDeleteAttachment,
  canManageAttachments,
  openCard,
  navigateToSection
}) {
  const [attachmentToDelete, setAttachmentToDelete] = useState(null);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState('');
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [isCardDeleteOpen, setIsCardDeleteOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');

  const projectTasks = useMemo(() => columns.flatMap((column) =>
    column.cards.map((card) => ({ ...card, columnTitle: column.title }))
  ), [columns]);
  const filteredProjectTasks = useMemo(() => {
    const query = taskSearch.trim().toLocaleLowerCase('ar');
    if (!query) return projectTasks;
    return projectTasks.filter((card) => [card.title, card.description, card.assigneeName, card.columnTitle, ...(card.tags || [])]
      .some((value) => String(value || '').toLocaleLowerCase('ar').includes(query)));
  }, [projectTasks, taskSearch]);

  async function confirmAttachmentDelete() {
    if (!attachmentToDelete) return;
    const deleted = await handleDeleteAttachment(attachmentToDelete);
    if (deleted) setAttachmentToDelete(null);
  }

  async function saveEditedComment() {
    const updated = await handleUpdateComment(editingCommentId, editingCommentBody);
    if (updated) {
      setEditingCommentId('');
      setEditingCommentBody('');
    }
  }

  async function confirmCommentDelete() {
    if (!commentToDelete) return;
    const deleted = await handleDeleteComment(commentToDelete.id);
    if (deleted) setCommentToDelete(null);
  }

  function addMention(member) {
    const mention = `@${member.name}`;
    setCommentBody((currentBody) => currentBody.includes(mention)
      ? currentBody
      : `${currentBody}${currentBody && !currentBody.endsWith(' ') ? ' ' : ''}${mention} `);
  }

  return (
    selectedCardId ? (
                <aside className="card-details task-details-page" aria-label="Card details">
                  <div className="card-details-header task-details-topbar">
                    <div>
                      <p className="eyebrow">تفاصيل البطاقة</p>
                      <h3>{selectedCard?.title || 'جاري فتح البطاقة...'}</h3>
                    </div>
                    <div className="details-actions">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => setIsCardDeleteOpen(true)}
                        disabled={!canDeleteSelectedCard || isDeletingCard || isLoadingCardDetails}
                      >
                        {isDeletingCard ? 'جاري الحذف...' : 'حذف'}
                      </button>
                      <button type="button" className="secondary-button" onClick={closeCard}>
                        إغلاق
                      </button>
                    </div>
                  </div>

                  {cardDetailsError ? <p className="form-error">{cardDetailsError}</p> : null}

                  {isLoadingCardDetails ? (
                    <p className="empty-state">جاري تحميل تفاصيل البطاقة...</p>
                  ) : selectedCard ? (
                    <>
                      <section className="task-detail-hero" aria-label="Task summary">
                        <div className="task-chip-row">
                          <span className="task-code">TASK-{String(selectedCard.id || '').slice(0, 4).toUpperCase()}</span>
                          <span className={`task-priority-chip ${cardDetailsForm.priority || selectedCard.priority || 'normal'}`}>
                            <Flag size={15} aria-hidden="true" />
                            {priorityLabels[cardDetailsForm.priority || selectedCard.priority] || priorityLabels.normal}
                          </span>
                          {cardDetailsForm.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="task-tag-chip">#{tag}</span>
                          ))}
                        </div>
                        <div className="task-property-grid">
                          <div>
                            <span><UserRound size={16} aria-hidden="true" /> المسؤول</span>
                            <strong>{boardMembers.find((member) => member.id === cardDetailsForm.assigneeId)?.name || 'غير معيّن'}</strong>
                          </div>
                          <div>
                            <span><Calendar size={16} aria-hidden="true" /> تاريخ الاستحقاق</span>
                            <strong>{cardDetailsForm.dueDate || 'بدون تاريخ'}</strong>
                          </div>
                          <div>
                            <span><ListChecks size={16} aria-hidden="true" /> المهام الفرعية</span>
                            <strong>
                              {cardDetailsForm.checklist.filter((item) => item.status === 'done' || item.done).length}/{cardDetailsForm.checklist.length}
                            </strong>
                          </div>
                        </div>
                      </section>
                      <div className="task-details-grid">
                        <form className="details-form task-main-pane" onSubmit={handleSaveCardDetails}>
                        <label>
                          عنوان البطاقة
                          <input
                            value={cardDetailsForm.title}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                title: event.target.value
                              }))
                            }
                            placeholder="عنوان البطاقة"
                            disabled={!canEditSelectedCardDetails}
                          />
                        </label>
                        <label>
                          الوصف
                          <textarea
                            value={cardDetailsForm.description}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                description: event.target.value
                              }))
                            }
                            placeholder="اكتب وصف المهمة"
                            rows="4"
                            disabled={!canEditSelectedCardDetails}
                          />
                        </label>
                        <label>
                          تاريخ الاستحقاق
                          <input
                            type="date"
                            value={cardDetailsForm.dueDate}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                dueDate: event.target.value
                              }))
                            }
                            disabled={!canEditSelectedCardDetails}
                          />
                        </label>
                        <label>
                          المسؤول
                          <select
                            value={cardDetailsForm.assigneeId}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                assigneeId: event.target.value
                              }))
                            }
                            disabled={!canEditSelectedCardDetails}
                          >
                            <option value="">بدون مسؤول</option>
                            {managerMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          الأولوية
                          <select
                            value={cardDetailsForm.priority}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                priority: event.target.value
                              }))
                            }
                            disabled={!canEditSelectedCardDetails}
                          >
                            <option value="urgent">عاجل</option>
                            <option value="medium">متوسط</option>
                            <option value="normal">عادي</option>
                          </select>
                        </label>
                        <section className="tags-editor" aria-label="Tags">
                          <div className="tags-editor-header">
                            <h4>التصنيفات</h4>
                            <span>{cardDetailsForm.tags.length}/8</span>
                          </div>
                          <div className="tag-input-row">
                            <input
                              value={cardDetailsForm.tagDraft}
                              onChange={(event) =>
                                setCardDetailsForm((currentForm) => ({
                                  ...currentForm,
                                  tagDraft: event.target.value
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  addTag();
                                }
                              }}
                              placeholder="مثلاً: Frontend"
                              disabled={!canEditSelectedCardDetails}
                            />
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={addTag}
                              disabled={!canEditSelectedCardDetails || !cardDetailsForm.tagDraft.trim() || cardDetailsForm.tags.length >= 8}
                            >
                              إضافة
                            </button>
                          </div>
                          {cardDetailsForm.tags.length === 0 ? (
                            <p className="column-empty">لا توجد تصنيفات بعد.</p>
                          ) : (
                            <div className="editable-tag-list">
                              {cardDetailsForm.tags.map((tag) => (
                                <span key={tag}>
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    aria-label={`Remove ${tag}`}
                                    disabled={!canEditSelectedCardDetails}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </section>
                        <section className="checklist-editor" aria-label="Checklist">
                          <div className="checklist-header">
                            <h4>قائمة المهام الفرعية</h4>
                            <button
                              type="button"
                              className="secondary-button small-button"
                              onClick={addChecklistItem}
                              disabled={!canEditSelectedSubtasks}
                            >
                              إضافة مهمة
                            </button>
                          </div>
                          <small className="checklist-workflow-note">تُحدّث حالة التنفيذ والاعتماد من صفحة «مهامي ومراجعاتي».</small>
                          {cardDetailsForm.checklist.length === 0 ? (
                            <p className="column-empty">لا توجد مهام فرعية بعد.</p>
                          ) : (
                            <div className="checklist-items">
                              {cardDetailsForm.checklist.map((item) => (
                                <div key={item.id} className="checklist-item">
                                  <input
                                    value={item.text}
                                    onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                                    placeholder="اكتب مهمة فرعية"
                                    disabled
                                  />
                                  <select
                                    value={item.assigneeId || ''}
                                    onChange={(event) => updateChecklistItem(item.id, { assigneeId: event.target.value })}
                                    aria-label="Subtask assignee"
                                    disabled={!canEditSelectedSubtasks}
                                  >
                                    <option value="">بدون عضو</option>
                                    {boardMembers.map((member) => (
                                      <option key={member.id} value={member.id}>
                                        {member.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={item.status || (item.done ? 'done' : 'todo')}
                                    onChange={(event) => updateChecklistItem(item.id, { status: event.target.value })}
                                    aria-label="Subtask status"
                                    disabled={!canEditSelectedSubtasks}
                                  >
                                    <option value="todo">لم تبدأ</option>
                                    <option value="in_progress">قيد التنفيذ</option>
                                    <option value="review">بانتظار المراجعة</option>
                                    <option value="changes_requested" disabled={!canEditSelectedSubtasks}>مطلوب تعديل</option>
                                    <option value="done" disabled={!canEditSelectedSubtasks}>مكتملة ومعتمدة</option>
                                  </select>
                                  <button
                                    type="button"
                                    className="icon-danger-button"
                                    onClick={() => removeChecklistItem(item.id)}
                                    aria-label="Remove checklist item"
                                    disabled={!canEditSelectedSubtasks}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                        <section className="attachments-panel" aria-label="مرفقات البطاقة">
                          <div className="attachments-heading">
                            <div><Paperclip size={18} /><h4>المرفقات</h4></div>
                            <span>{attachments.length}</span>
                          </div>
                          {canManageAttachments ? (
                            <label className={`attachment-upload ${isUploadingAttachment ? 'is-loading' : ''}`}>
                              <Paperclip size={17} />
                              <span>{isUploadingAttachment ? 'جاري رفع الملف...' : 'إضافة مرفق'}</span>
                              <input
                                type="file"
                                onChange={handleUploadAttachment}
                                disabled={isUploadingAttachment}
                                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json,application/zip,.doc,.docx,.xls,.xlsx"
                              />
                            </label>
                          ) : null}
                          <small>الحد الأقصى للملف 5 ميجابايت.</small>
                          {attachments.length === 0 ? (
                            <p className="column-empty">لا توجد مرفقات لهذه البطاقة بعد.</p>
                          ) : (
                            <div className="attachments-list">
                              {attachments.map((attachment) => (
                                <article key={attachment.id} className="attachment-item">
                                  <span className="attachment-file-icon"><FileText size={19} /></span>
                                  <div>
                                    <strong title={attachment.name}>{attachment.name}</strong>
                                    <small>{formatFileSize(attachment.size)} · {attachment.uploaderName || 'مستخدم'}</small>
                                  </div>
                                  <button type="button" className="attachment-action" onClick={() => handleDownloadAttachment(attachment)} title="تنزيل"><Download size={17} /></button>
                                  {canManageAttachments ? (
                                    <button type="button" className="attachment-action delete" onClick={() => setAttachmentToDelete(attachment)} disabled={deletingAttachmentId === attachment.id} title="حذف"><Trash2 size={17} /></button>
                                  ) : null}
                                </article>
                              ))}
                            </div>
                          )}
                        </section>
                        <button type="submit" disabled={isSavingCardDetails || !canSaveSelectedCard}>
                          {isSavingCardDetails ? 'جاري الحفظ...' : 'حفظ التفاصيل'}
                        </button>
                        </form>

                        <aside className="task-activity-pane">
                      <section className="task-timeline" aria-label="سجل نشاط البطاقة">
                        <div className="task-timeline-heading">
                          <div>
                            <Activity size={18} />
                            <h3>سجل النشاط</h3>
                          </div>
                          <span>{cardActivity.length}</span>
                        </div>
                        <div className="task-timeline-list">
                          {cardActivity.length === 0 ? (
                            <p className="column-empty">لا يوجد نشاط مسجل لهذه البطاقة بعد.</p>
                          ) : cardActivity.map((activity) => {
                            const ActivityIcon = activityIcons[activity.action] || Activity;
                            return (
                              <article key={activity.id} className="task-timeline-item">
                                <span className="task-timeline-actor">
                                  <UserAvatar src={activity.actorAvatarUrl} name={activity.actorName || 'النظام'} fallbackLength={2} />
                                  <span className={`task-timeline-icon ${activity.action}`}><ActivityIcon size={11} /></span>
                                </span>
                                <div>
                                  <p><strong>{activity.actorName || 'النظام'}</strong> {activityDescription(activity)}</p>
                                  <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString('ar')}</time>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                      <section className="comments-panel" aria-label="Card comments">
                        <div className="comments-heading">
                          <div><MessageSquare size={18} /><h3>التعليقات</h3></div>
                          <span>{comments.length}</span>
                        </div>
                        <form className="comment-form" onSubmit={handleAddComment}>
                          <textarea
                            value={commentBody}
                            onChange={(event) => setCommentBody(event.target.value)}
                            placeholder="اكتب تعليقاً"
                            rows="3"
                          />
                          <div className="mention-suggestions" aria-label="الإشارة إلى عضو">
                            <small>إشارة إلى:</small>
                            {boardMembers.filter((member) => member.id !== user?.id).map((member) => (
                              <button key={member.id} type="button" onClick={() => addMention(member)}>
                                <UserAvatar src={member.avatarUrl} name={member.name} />
                                @{member.name}
                              </button>
                            ))}
                          </div>
                          <button type="submit" disabled={isAddingComment}>
                            {isAddingComment ? 'جاري الإضافة...' : 'إضافة تعليق'}
                          </button>
                        </form>

                        <div className="comments-list">
                          {comments.length === 0 ? (
                            <p className="column-empty">لا توجد تعليقات بعد.</p>
                          ) : (
                            comments.map((comment) => (
                              <article key={comment.id} className="comment-card">
                                <header className="comment-card-header">
                                  <UserAvatar src={comment.authorAvatarUrl} name={comment.authorName} fallbackLength={2} className="comment-author-avatar" />
                                  <div><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ar')}{comment.editedAt ? ' · تم التعديل' : ''}</time></div>
                                  <div className="comment-actions">
                                    {comment.userId === user?.id ? <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentBody(comment.body); }} title="تعديل"><Pencil size={15} /></button> : null}
                                    {(comment.userId === user?.id || canDeleteSelectedCard) ? <button type="button" className="delete" onClick={() => setCommentToDelete(comment)} title="حذف"><Trash2 size={15} /></button> : null}
                                  </div>
                                </header>
                                {editingCommentId === comment.id ? (
                                  <div className="comment-edit-form">
                                    <textarea value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)} rows="3" autoFocus />
                                    <div>
                                      <button type="button" className="secondary-button" onClick={() => { setEditingCommentId(''); setEditingCommentBody(''); }} disabled={updatingCommentId === comment.id}>إلغاء</button>
                                      <button type="button" onClick={saveEditedComment} disabled={!editingCommentBody.trim() || updatingCommentId === comment.id}>{updatingCommentId === comment.id ? 'جاري الحفظ...' : 'حفظ التعديل'}</button>
                                    </div>
                                  </div>
                                ) : <p>{comment.body}</p>}
                              </article>
                            ))
                          )}
                        </div>
                      </section>
                        </aside>
                      </div>
                      {attachmentToDelete ? (
                        <AttachmentDeleteDialog
                          attachment={attachmentToDelete}
                          isDeleting={deletingAttachmentId === attachmentToDelete.id}
                          onCancel={() => setAttachmentToDelete(null)}
                          onConfirm={confirmAttachmentDelete}
                        />
                      ) : null}
                      {commentToDelete ? (
                        <CommentDeleteDialog
                          comment={commentToDelete}
                          isDeleting={deletingCommentId === commentToDelete.id}
                          onCancel={() => setCommentToDelete(null)}
                          onConfirm={confirmCommentDelete}
                        />
                      ) : null}
                      {isCardDeleteOpen ? (
                        <CardDeleteDialog
                          card={selectedCard}
                          isDeleting={isDeletingCard}
                          onCancel={() => setIsCardDeleteOpen(false)}
                          onConfirm={handleDeleteCard}
                        />
                      ) : null}
                    </>
                  ) : null}
                </aside>
              ) : (
                <section className="card-details task-index-page" aria-label="مهام المشروع">
                  <header className="task-index-header">
                    <div>
                      <p className="eyebrow">مهام المشروع</p>
                      <h3>تفاصيل المهمة والنشاط</h3>
                      <p>اختر بطاقة لمتابعة تفاصيلها ومهامها الفرعية وتعليقات الفريق وسجل نشاطها.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => navigateToSection('kanban')}>فتح لوحة الكانبان</button>
                  </header>
                  <div className="task-index-toolbar">
                    <label className="task-index-search">
                      <Search size={18} aria-hidden="true" />
                      <input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="ابحث في عنوان المهمة أو وصفها أو المسؤول..." />
                    </label>
                    <span>{filteredProjectTasks.length} من {projectTasks.length} بطاقة</span>
                  </div>
                  {filteredProjectTasks.length ? (
                    <div className="task-index-grid">
                      {filteredProjectTasks.map((card) => {
                        const completed = card.checklist?.filter((item) => item.status === 'done' || item.done).length || 0;
                        const total = card.checklist?.length || 0;
                        return (
                          <button key={card.id} type="button" className="task-index-card" onClick={() => openCard(card.id)}>
                            <span className="task-index-card-top"><span>{card.columnTitle}</span><strong className={`task-priority-chip ${card.priority || 'normal'}`}>{priorityLabels[card.priority] || priorityLabels.normal}</strong></span>
                            <strong className="task-index-title">{card.title}</strong>
                            <p>{card.description || 'لا يوجد وصف لهذه البطاقة.'}</p>
                            <span className="task-index-meta">
                              <span><UserAvatar src={card.assigneeAvatarUrl} name={card.assigneeName || 'غير معيّن'} />{card.assigneeName || 'غير معيّن'}</span>
                              <span><CheckCircle2 size={15} />{completed}/{total}</span>
                              {card.dueDate ? <span><Calendar size={15} />{card.dueDate}</span> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state"><ListChecks size={30} /><strong>{projectTasks.length ? 'لا توجد نتائج مطابقة' : 'لا توجد بطاقات في هذا المشروع بعد'}</strong><span>{projectTasks.length ? 'جرّب عبارة بحث مختلفة.' : 'أنشئ بطاقة من لوحة الكانبان لتظهر هنا.'}</span></div>
                  )}
                </section>
              )
  );
}

export default TaskDetailsPage;
