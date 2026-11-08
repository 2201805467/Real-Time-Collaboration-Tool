import React from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CircleCheck, ListChecks, MessageSquare, MoreHorizontal, Paperclip, Plus, Trash2 } from 'lucide-react';
import UserAvatar from '../components/UserAvatar.jsx';
import { getDueDateMeta, isCompletionColumn } from '../utils/dueDate.js';

const priorityStyles = {
  urgent: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  normal: 'bg-surface-container text-on-surface-variant'
};

const priorityLabels = { urgent: 'عاجل', medium: 'متوسط', normal: 'عادي' };
const columnDotStyles = ['bg-outline', 'bg-primary-container animate-pulse', 'bg-tertiary-container', 'bg-secondary'];
const tagStyles = [
  'bg-primary-fixed text-on-primary-fixed-variant',
  'bg-secondary-container text-on-secondary-container',
  'bg-surface-container-highest text-on-surface',
  'bg-tertiary-fixed text-on-tertiary-fixed-variant'
];

function getChecklistProgress(card) {
  return card.checklistTotal ? Math.round((card.completedChecklistItems / card.checklistTotal) * 100) : 0;
}

function DroppableColumn({ column, index, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column flex flex-col rounded-2xl bg-surface-container-low/80 p-space-md shadow-stitch transition-all ${
        isOver ? 'over ring-2 ring-primary-container bg-primary-fixed' : ''
      }`}
      data-column-tone={index % columnDotStyles.length}
    >
      {children}
    </section>
  );
}

function DraggableCard({ card, onOpen, canMove, isComplete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, disabled: !canMove });
  const progress = getChecklistProgress(card);
  const dueDateMeta = isComplete ? null : getDueDateMeta(card.dueDate);

  return (
    <article
      ref={setNodeRef}
      className={`task-card ${dueDateMeta ? `due-${dueDateMeta.tone}` : ''} group rounded-xl bg-surface-container-lowest p-space-md shadow-stitch transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${
        canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'dragging opacity-75 shadow-card' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => onOpen(card.id)}
      {...(canMove ? listeners : {})}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-space-sm">
        {card.tags?.[0] ? (
          <span className={`max-w-[62%] truncate rounded-full px-2 py-0.5 text-label-sm font-semibold ${tagStyles[0]}`}>{card.tags[0]}</span>
        ) : (
          <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm font-semibold text-on-surface-variant">General</span>
        )}
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-semibold ${priorityStyles[card.priority] || priorityStyles.normal}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {priorityLabels[card.priority] || priorityLabels.normal}
        </span>
      </div>
      <h4 className="text-headline-sm font-semibold leading-6 text-on-surface transition-colors group-hover:text-primary">{card.title}</h4>
      {card.description ? <p className="line-clamp-2 text-body-sm leading-5 text-on-surface-variant">{card.description}</p> : null}
      {card.checklistTotal ? (
        <div className="grid gap-1 rounded-lg bg-surface-container-low p-2">
          <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1"><ListChecks size={15} /><span>Checklist</span></span>
            <span className="font-code font-semibold text-on-surface">{card.completedChecklistItems}/{card.checklistTotal}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
            <span className="block h-full rounded-full bg-primary-container" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}
      {card.tags?.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.slice(1, 4).map((tag, index) => (
            <span key={tag} className={`rounded-full px-2 py-0.5 text-label-sm font-semibold ${tagStyles[(index + 1) % tagStyles.length]}`}>{tag}</span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-space-sm pt-space-xs">
        {card.assigneeName ? (
          <UserAvatar src={card.assigneeAvatarUrl} name={card.assigneeName} fallbackLength={2} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-tertiary-container text-[10px] font-semibold text-on-tertiary ring-2 ring-surface-container-lowest" />
        ) : <span />}
        <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
          {card.commentCount ? <span className="inline-flex items-center gap-1"><MessageSquare size={15} /><span>{card.commentCount}</span></span> : null}
          {card.checklistTotal ? <span className="inline-flex items-center gap-1"><CircleCheck size={15} /><span>{progress}%</span></span> : null}
          {card.dueDate ? <span className={`card-due-date ${dueDateMeta?.tone || 'complete'} inline-flex items-center gap-1`}><Calendar size={15} /><span>{dueDateMeta?.label || card.dueDate}</span></span> : null}
        </div>
      </div>
    </article>
  );
}

function KanbanPage({
  sensors,
  searchQuery,
  priorityFilter,
  tagFilter,
  assigneeFilter,
  allTags,
  boardMembers,
  filteredCardsCount,
  totalCardsCount,
  hasActiveFilters,
  isLoadingBoard,
  userIsBoardOwner,
  newColumnTitle,
  isCreatingColumn,
  filteredColumns,
  columnDrafts,
  savingColumnId,
  deletingColumnId,
  cardTitles,
  isCreatingCard,
  user,
  onSearchChange,
  onPriorityFilterChange,
  onTagFilterChange,
  onAssigneeFilterChange,
  onClearFilters,
  onNewColumnTitleChange,
  onCreateColumn,
  onColumnDraftChange,
  onUpdateColumn,
  onDeleteColumn,
  onOpenCard,
  onCardTitleChange,
  onCreateCard,
  onDragEnd
}) {
  return (
    <>
      <section className="filter-panel rounded-xl bg-surface-container-lowest p-space-md shadow-stitch" id="filters" aria-label="Card filters">
        <label>البحث<input value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="ابحث في العنوان أو الوصف" /></label>
        <label>
          الأولوية
          <select value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value)}>
            <option value="all">كل الأولويات</option><option value="urgent">عاجل</option><option value="medium">متوسط</option><option value="normal">عادي</option>
          </select>
        </label>
        <label>
          التصنيف
          <select value={tagFilter} onChange={(event) => onTagFilterChange(event.target.value)}>
            <option value="all">كل التصنيفات</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <label>
          المسؤول
          <select value={assigneeFilter} onChange={(event) => onAssigneeFilterChange(event.target.value)}>
            <option value="all">كل المسؤولين</option><option value="">بدون مسؤول</option>
            {boardMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <div className="filter-summary">
          <span className="rounded-full bg-surface-container px-3 py-2 font-code text-code-sm text-on-surface">{filteredCardsCount}/{totalCardsCount}</span>
          <button type="button" className="secondary-button" onClick={onClearFilters} disabled={!hasActiveFilters}>مسح</button>
        </div>
      </section>

      {isLoadingBoard ? <p className="empty-state">جاري تحميل اللوحة...</p> : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {userIsBoardOwner ? (
            <form className="add-column-form rounded-xl bg-surface-container-lowest p-space-md shadow-stitch" onSubmit={onCreateColumn}>
              <input value={newColumnTitle} onChange={(event) => onNewColumnTitleChange(event.target.value)} placeholder="إضافة عمود جديد" />
              <button type="submit" className="inline-flex items-center justify-center gap-2" disabled={isCreatingColumn || !newColumnTitle.trim()}>
                <Plus size={18} /> {isCreatingColumn ? '...' : 'إضافة عمود'}
              </button>
            </form>
          ) : null}

          <div className="kanban-board grid grid-cols-1 gap-space-lg md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredColumns.map((column, columnIndex) => (
              <DroppableColumn key={column.id} column={column} index={columnIndex}>
                <header className="column-header flex items-start justify-between gap-space-sm pb-space-sm">
                  <form className="column-title-form min-w-0 flex-1" onSubmit={(event) => onUpdateColumn(event, column.id)}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${columnDotStyles[columnIndex % columnDotStyles.length]}`} />
                      <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-sm font-bold text-on-surface-variant">{column.cards.length}</span>
                    </div>
                    <input
                      value={columnDrafts[column.id] ?? column.title}
                      onChange={(event) => onColumnDraftChange(column.id, event.target.value)}
                      aria-label="Column title"
                      className="rounded-lg border-0 bg-transparent px-0 text-headline-sm font-semibold text-on-surface focus:outline-none focus:ring-0"
                      disabled={!userIsBoardOwner}
                    />
                    <button type="submit" className="small-button inline-flex items-center justify-center rounded-lg bg-surface-container-lowest px-2 text-primary shadow-stitch" disabled={!userIsBoardOwner || savingColumnId === column.id || !String(columnDrafts[column.id] || '').trim()}>
                      {savingColumnId === column.id ? '...' : 'حفظ'}
                    </button>
                  </form>
                  <div className="column-meta flex items-center gap-1 text-on-surface-variant">
                    <button type="button" className="icon-plain-button" aria-label="Column options"><MoreHorizontal size={18} /></button>
                    <button type="button" className="icon-danger-button" onClick={() => onDeleteColumn(column.id)} disabled={!userIsBoardOwner || deletingColumnId === column.id} title="حذف العمود" aria-label="Delete column"><Trash2 size={18} /></button>
                  </div>
                </header>

                <div className="card-list">
                  {column.cards.length === 0 ? <p className="column-empty">{hasActiveFilters ? 'لا توجد بطاقات مطابقة.' : 'اسحب بطاقة إلى هنا.'}</p> : (
                    column.cards.map((card) => <DraggableCard key={card.id} card={card} onOpen={onOpenCard} canMove={userIsBoardOwner || card.assigneeId === user?.id} isComplete={isCompletionColumn(column.title)} />)
                  )}
                </div>

                {userIsBoardOwner ? (
                  <form className="card-form" onSubmit={(event) => onCreateCard(event, column.id)}>
                    <input value={cardTitles[column.id] || ''} onChange={(event) => onCardTitleChange(column.id, event.target.value)} placeholder="إضافة بطاقة" />
                    <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-lowest py-2 text-on-surface-variant shadow-stitch hover:bg-surface-container-high hover:text-on-surface" disabled={isCreatingCard === column.id}>
                      <Plus size={18} /> {isCreatingCard === column.id ? '...' : 'إضافة'}
                    </button>
                  </form>
                ) : null}
              </DroppableColumn>
            ))}
          </div>
        </DndContext>
      )}
    </>
  );
}

export default KanbanPage;
