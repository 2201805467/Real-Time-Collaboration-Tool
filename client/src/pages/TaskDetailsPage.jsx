import React from 'react';
import { Calendar, Flag, ListChecks, Tags, UserRound } from 'lucide-react';

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
  commentBody,
  isAddingComment,
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
  navigateToSection
}) {
  return (
    selectedCardId ? (
                <aside className="card-details task-details-page" aria-label="Card details">
                  <div className="card-details-header task-details-topbar">
                    <div>
                      <p className="eyebrow">Card</p>
                      <h3>{selectedCard?.title || 'جاري فتح البطاقة...'}</h3>
                    </div>
                    <div className="details-actions">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={handleDeleteCard}
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
                            <span><UserRound size={16} aria-hidden="true" /> Assignee</span>
                            <strong>{boardMembers.find((member) => member.id === cardDetailsForm.assigneeId)?.name || 'Unassigned'}</strong>
                          </div>
                          <div>
                            <span><Calendar size={16} aria-hidden="true" /> Due date</span>
                            <strong>{cardDetailsForm.dueDate || 'No due date'}</strong>
                          </div>
                          <div>
                            <span><ListChecks size={16} aria-hidden="true" /> Subtasks</span>
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
                                    disabled={!canEditSelectedSubtasks}
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
                                    disabled={!canEditSelectedSubtasks && item.assigneeId !== user?.id}
                                  >
                                    <option value="todo">لم تبدأ</option>
                                    <option value="in_progress">قيد التنفيذ</option>
                                    <option value="done">تم الانتهاء</option>
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
                        <button type="submit" disabled={isSavingCardDetails || !canSaveSelectedCard}>
                          {isSavingCardDetails ? 'جاري الحفظ...' : 'حفظ التفاصيل'}
                        </button>
                        </form>

                        <aside className="task-activity-pane">
                      <section className="comments-panel" aria-label="Card comments">
                        <h3>التعليقات</h3>
                        <form className="comment-form" onSubmit={handleAddComment}>
                          <textarea
                            value={commentBody}
                            onChange={(event) => setCommentBody(event.target.value)}
                            placeholder="اكتب تعليقاً"
                            rows="3"
                          />
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
                                <strong>{comment.authorName}</strong>
                                <p>{comment.body}</p>
                                <time dateTime={comment.createdAt}>
                                  {new Date(comment.createdAt).toLocaleString('ar')}
                                </time>
                              </article>
                            ))
                          )}
                        </div>
                      </section>
                        </aside>
                      </div>
                    </>
                  ) : null}
                </aside>
              ) : (
                <section className="card-details task-details-empty" aria-label="Task details placeholder">
                  <div className="card-details-header">
                    <div>
                      <p className="eyebrow">Task Activity</p>
                      <h3>Select a card from the Kanban board</h3>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => navigateToSection('kanban')}>
                      Open Kanban
                    </button>
                  </div>
                  <p className="empty-state">Card details, subtasks, comments, and activity will appear here after you select a card.</p>
                </section>
              )
  );
}

export default TaskDetailsPage;
