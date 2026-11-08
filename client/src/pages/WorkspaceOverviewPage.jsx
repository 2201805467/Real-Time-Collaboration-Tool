import React, { useMemo, useState } from 'react';
import {
  CircleCheck,
  Clock3,
  FolderOpen,
  Gauge,
  Grid2X2,
  LogOut,
  Pencil,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Trash2,
  UsersRound,
  X,
  Zap
} from 'lucide-react';
import UserAvatar from '../components/UserAvatar.jsx';
import { getDueDateMeta } from '../utils/dueDate.js';

function WorkspaceOverviewPage({
  workspaceStats,
  presenceUsers,
  isConnected,
  isLoadingBoards,
  boards,
  boardTitle,
  isCreatingBoard,
  boardsError,
  roleLabels,
  workspaceActivity,
  user,
  savingBoardId,
  deletingBoardId,
  onBoardTitleChange,
  onCreateBoard,
  onOpenBoard,
  onRenameBoard,
  onDeleteBoard,
  onNavigate,
  onLogout
}) {
  const [projectFilter, setProjectFilter] = useState('all');
  const [projectSearch, setProjectSearch] = useState('');
  const [editingBoardId, setEditingBoardId] = useState('');
  const [editingBoardTitle, setEditingBoardTitle] = useState('');
  const normalizedSearch = projectSearch.trim().toLowerCase();
  const displayedBoards = useMemo(
    () => boards.filter((board) => {
      const matchesFilter =
        projectFilter === 'all' ||
        (projectFilter === 'owned' && board.role === 'owner') ||
        (projectFilter === 'shared' && board.role !== 'owner');
      const matchesSearch = !normalizedSearch || board.title.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    }),
    [boards, projectFilter, normalizedSearch]
  );

  function startEditingBoard(board) {
    setEditingBoardId(board.id);
    setEditingBoardTitle(board.title);
  }

  function cancelEditingBoard() {
    setEditingBoardId('');
    setEditingBoardTitle('');
  }

  async function submitBoardRename(event, boardId) {
    event.preventDefault();
    const renamed = await onRenameBoard(boardId, editingBoardTitle);

    if (renamed) {
      cancelEditingBoard();
    }
  }

  return (
    <section className="dashboard-panel workspace-hub" aria-label="مركز مساحات العمل والمشاريع">
      <div className="workspace-hub-head">
        <div>
          <div className="hub-kicker">
            <span>مساحة عمل رقمية موحدة</span>
            <span className="hub-code">ORG-FLOW</span>
          </div>
          <h2>مركز مساحات العمل والمشاريع</h2>
          <p>إدارة وتتبع سير عمليات التطوير وتفاعل الفرق في الزمن الفعلي.</p>
        </div>
        <div className="hub-actions">
          <button type="button" className="secondary-button">
            <SlidersHorizontal size={18} aria-hidden="true" />
            تخصيص المساحات
          </button>
          <button type="button" onClick={() => document.querySelector('.board-form input')?.focus()}>
            <Plus size={18} aria-hidden="true" />
            مشروع جديد
          </button>
        </div>
      </div>

      <div className="hub-metrics" aria-label="Workspace metrics">
        <article>
          <span><FolderOpen size={18} aria-hidden="true" /></span>
          <p>المشاريع النشطة</p>
          <strong>{workspaceStats.boards.total}</strong>
          <small>{workspaceStats.boards.total === 1 ? 'لوحة واحدة متاحة' : `${workspaceStats.boards.total} لوحة متاحة`}</small>
        </article>
        <article>
          <span><CircleCheck size={18} aria-hidden="true" /></span>
          <p>المهام المنجزة هذا الأسبوع</p>
          <strong>{workspaceStats.cards.completedThisWeek}</strong>
          <small>{workspaceStats.cards.completed} بطاقة مكتملة من أصل {workspaceStats.cards.total}</small>
        </article>
        <article>
          <span><UsersRound size={18} aria-hidden="true" /></span>
          <p>الأعضاء المتصلون الآن</p>
          <strong>{presenceUsers.length}</strong>
          <small>{isConnected ? 'الاتصال اللحظي يعمل الآن.' : 'الاتصال اللحظي غير متصل حاليا.'}</small>
        </article>
        <article>
          <span><Gauge size={18} aria-hidden="true" /></span>
          <p>معدل سرعة الإنجاز</p>
          <strong>{workspaceStats.velocity}%</strong>
          <small>{workspaceStats.checklist.completed}/{workspaceStats.checklist.total} مهمة فرعية مكتملة</small>
        </article>
      </div>

      <div className="hub-command-bar">
        <div className="hub-tabs" aria-label="Workspace filters">
          <button type="button" className={projectFilter === 'all' ? 'active' : ''} onClick={() => setProjectFilter('all')}>جميع المساحات <span>{workspaceStats.boards.total}</span></button>
          <button type="button" className={projectFilter === 'owned' ? 'active' : ''} onClick={() => setProjectFilter('owned')}>أملكها <span>{workspaceStats.boards.owned}</span></button>
          <button type="button" className={projectFilter === 'shared' ? 'active' : ''} onClick={() => setProjectFilter('shared')}>مشتركة <span>{workspaceStats.boards.shared}</span></button>
        </div>
        <div className="hub-search">
          <Search size={18} aria-hidden="true" />
          <input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="البحث عن لوحة أو مشروع..." aria-label="البحث عن المشاريع" />
          {projectSearch ? (
            <button type="button" className="hub-search-clear" onClick={() => setProjectSearch('')} aria-label="مسح البحث"><X size={16} /></button>
          ) : null}
          <Grid2X2 size={18} aria-hidden="true" />
        </div>
      </div>

      <div className="hub-layout">
        <section className="hub-projects" aria-label="Projects">
          <div className="hub-section-title">
            <div>
              <h3>لوحات العمل النشطة</h3>
              <p>{isLoadingBoards ? 'جاري تحميل اللوحات...' : `${displayedBoards.length} من ${boards.length} مشروع معروض`}</p>
            </div>
            <span><Zap size={14} aria-hidden="true" /> التحديث التلقائي نشط</span>
          </div>

          <form onSubmit={onCreateBoard} className="board-form hub-create-card">
            <label>
              اسم المشروع
              <input value={boardTitle} onChange={(event) => onBoardTitleChange(event.target.value)} placeholder="مثلا: مشروع التخرج" />
            </label>
            <button type="submit" disabled={isCreatingBoard}>
              <Plus size={18} aria-hidden="true" />
              {isCreatingBoard ? 'جاري الإنشاء...' : 'إنشاء لوحة'}
            </button>
          </form>

          {boardsError ? <p className="form-error">{boardsError}</p> : null}

          <div className="boards-list hub-board-grid">
            {isLoadingBoards ? (
              <p className="empty-state">جاري تحميل اللوحات...</p>
            ) : displayedBoards.length === 0 ? (
              <p className="empty-state">
                {boards.length === 0
                  ? 'لا توجد لوحات مشاريع بعد. أنشئ أول لوحة لبدء التعاون.'
                  : 'لا توجد مشاريع تطابق البحث أو التصفية الحالية.'}
              </p>
            ) : (
              displayedBoards.map((board) => (
                <article key={board.id} className="board-card hub-board-card">
                  <span className="hub-board-accent" />
                  <div className="hub-board-topline">
                    <span className="hub-board-icon">{board.title.slice(0, 1).toUpperCase()}</span>
                    <span className={`role-badge ${board.role}`}>{roleLabels[board.role] || roleLabels.member}</span>
                  </div>
                  <div>
                    <div className="hub-board-tags">
                      <span>{board.stats?.cardsTotal || 0} بطاقة</span>
                      <span>{board.stats?.subtasksTotal || 0} مهمة فرعية</span>
                      <span>{roleLabels[board.role] || roleLabels.member}</span>
                    </div>
                    {editingBoardId === board.id ? (
                      <form className="hub-board-rename" onSubmit={(event) => submitBoardRename(event, board.id)}>
                        <input
                          value={editingBoardTitle}
                          onChange={(event) => setEditingBoardTitle(event.target.value)}
                          autoFocus
                          maxLength="120"
                          aria-label="اسم المشروع الجديد"
                        />
                        <div>
                          <button type="submit" className="small-button" disabled={savingBoardId === board.id || !editingBoardTitle.trim()}>
                            {savingBoardId === board.id ? 'جاري الحفظ...' : 'حفظ'}
                          </button>
                          <button type="button" className="secondary-button small-button" onClick={cancelEditingBoard} disabled={savingBoardId === board.id}>إلغاء</button>
                        </div>
                      </form>
                    ) : <h2>{board.title}</h2>}
                    <p>افتح لوحة الكانبان، أدِر الأعمدة والبطاقات، وتعاون لحظيا مع الفريق.</p>
                  </div>
                  <div className="hub-board-progress">
                    <div>
                      <span>إنجاز المشروع</span>
                      <strong>{board.stats?.progress || 0}%</strong>
                    </div>
                    <div><span style={{ width: `${Math.min(100, board.stats?.progress || 0)}%` }} /></div>
                    <small>
                      {board.stats?.cardsCompleted || 0}/{board.stats?.cardsTotal || 0} بطاقة مكتملة،{' '}
                      {board.stats?.subtasksCompleted || 0}/{board.stats?.subtasksTotal || 0} مهمة منجزة
                    </small>
                  </div>
                  <div className="hub-board-footer">
                    <span title="آخر تحديث">
                      {board.updatedAt ? new Date(board.updatedAt).toLocaleDateString('ar') : '—'}
                    </span>
                    <div className="hub-mini-avatars" aria-label={`${board.stats?.memberCount || 0} أعضاء`}>
                      {(board.stats?.memberPreview || []).map((member) => (
                        <UserAvatar key={member.id} src={member.avatarUrl} name={member.name} />
                      ))}
                      {(board.stats?.memberCount || 0) > 3 ? (
                        <span title="أعضاء إضافيون">+{board.stats.memberCount - 3}</span>
                      ) : null}
                    </div>
                    <div className="hub-board-actions">
                      {board.role === 'owner' ? (
                        <>
                          <button type="button" className="icon-button" onClick={() => startEditingBoard(board)} disabled={savingBoardId === board.id || deletingBoardId === board.id} title="تعديل اسم المشروع" aria-label="تعديل اسم المشروع"><Pencil size={15} /></button>
                          <button type="button" className="icon-danger-button" onClick={() => onDeleteBoard(board.id, board.title)} disabled={deletingBoardId === board.id || savingBoardId === board.id} title="حذف المشروع" aria-label="حذف المشروع"><Trash2 size={15} /></button>
                        </>
                      ) : null}
                      <button type="button" className="small-button" onClick={() => onOpenBoard(board.id)}>فتح المشروع</button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="hub-side-panel" aria-label="Workspace activity">
          <section className="hub-deadlines-card">
            <div className="hub-section-title compact">
              <div><h3>المواعيد القريبة</h3><p>البطاقات التي تحتاج إلى انتباهك</p></div>
              <Clock3 size={18} aria-hidden="true" />
            </div>
            <div className="deadline-summary">
              <span className="overdue">{workspaceStats.deadlines?.overdue || 0} متأخرة</span>
              <span className="today">{workspaceStats.deadlines?.dueToday || 0} اليوم</span>
              <span>{workspaceStats.deadlines?.dueSoon || 0} قريبًا</span>
            </div>
            <div className="deadline-items">
              {(workspaceStats.deadlines?.items || []).length === 0 ? (
                <p className="column-empty">لا توجد مواعيد قريبة أو متأخرة.</p>
              ) : (workspaceStats.deadlines.items.map((item) => {
                const dueMeta = getDueDateMeta(item.dueDate);
                return (
                  <button key={item.cardId} type="button" onClick={() => onOpenBoard(item.boardId)}>
                    <span className={`deadline-dot ${dueMeta?.tone || 'normal'}`} />
                    <span><strong>{item.cardTitle}</strong><small>{item.boardTitle}</small></span>
                    <em className={dueMeta?.tone || 'normal'}>{dueMeta?.label || item.dueDate}</em>
                  </button>
                );
              }))}
            </div>
          </section>
          <section className="hub-quick-actions">
            <div className="hub-section-title compact">
              <div><h3>إجراءات فورية سريعة</h3><p>اختصارات لإدارة مساحة العمل</p></div>
              <Zap size={18} aria-hidden="true" />
            </div>
            <div className="hub-action-grid">
              <button type="button" onClick={() => document.querySelector('.board-form input')?.focus()}>
                <Plus size={18} aria-hidden="true" /><strong>مشروع جديد</strong><span>إنشاء لوحة</span>
              </button>
              <button type="button" onClick={() => onNavigate('team')} disabled>
                <UsersRound size={18} aria-hidden="true" /><strong>دعوة أعضاء</strong><span>افتح مشروعاً أولاً</span>
              </button>
              <button type="button">
                <SlidersHorizontal size={18} aria-hidden="true" /><strong>أتمتة المهام</strong><span>Webhook</span>
              </button>
              <button type="button">
                <Share2 size={18} aria-hidden="true" /><strong>تقرير</strong><span>PDF / Sprint</span>
              </button>
            </div>
          </section>

          <section className="hub-live-feed">
            <div className="hub-section-title compact">
              <div><h3>نشاط الفريق الحي</h3><p>آخر التحديثات داخل مساحة العمل</p></div>
              <span className="live-pill online">مباشر</span>
            </div>
            <div className="hub-feed-list">
              {workspaceActivity.length === 0 ? (
                <p className="empty-state">لا يوجد نشاط بعد. ابدأ بإنشاء أو تحديث بطاقة.</p>
              ) : (
                workspaceActivity.slice(0, 5).map((activity) => (
                  <article key={activity.id}>
                    <UserAvatar src={activity.actorAvatarUrl} name={activity.actorName || 'ن'} className="hub-feed-avatar" />
                    <p>
                      <strong>{activity.actorName || 'النظام'}</strong>{' '}
                      {activity.action === 'created' ? 'أنشأ' : activity.action === 'updated' ? 'حدّث' : activity.action === 'moved' ? 'نقل' : activity.action === 'deleted' ? 'حذف' : activity.action === 'commented' ? 'علّق على' : 'غيّر'}{' '}
                      {activity.entityType === 'card' ? 'بطاقة' : activity.entityType === 'board' ? 'لوحة' : activity.entityType}{' '}
                      في {activity.boardTitle}.
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="session-bar hub-session-card">
            <div><strong>{user.email}</strong><p>الجلسة محفوظة محليا في هذا المتصفح.</p></div>
            <button type="button" className="secondary-button" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" /> خروج
            </button>
          </section>
          <section className="hub-activity-card">
            <h3>آخر نشاط في مساحة العمل</h3>
            <p>{boards.length ? 'افتح مشروعا لعرض نشاط اللوحة والتعليقات المباشرة.' : 'أنشئ لوحة لبدء ظهور النشاط هنا.'}</p>
          </section>
          <section className="hub-storage-card">
            <div><span>المساحة السحابية</span><strong>{workspaceStats.storage.usedPercent}%</strong></div>
            <div className="storage-track"><span style={{ width: `${workspaceStats.storage.usedPercent}%` }} /></div>
            <small>{workspaceStats.storage.usedLabel} / {workspaceStats.storage.limitLabel}</small>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default WorkspaceOverviewPage;
