export function getDueDateMeta(dateValue) {
  if (!dateValue) return null;
  const dueDate = new Date(`${dateValue}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (daysLeft < 0) return { daysLeft, tone: 'overdue', label: `متأخرة منذ ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'يوم' : 'أيام'}` };
  if (daysLeft === 0) return { daysLeft, tone: 'today', label: 'اليوم' };
  if (daysLeft === 1) return { daysLeft, tone: 'soon', label: 'غدًا' };
  if (daysLeft === 2) return { daysLeft, tone: 'soon', label: 'بعد يومين' };
  return { daysLeft, tone: 'normal', label: dateValue };
}

export function isCompletionColumn(title) {
  const normalized = String(title || '').trim().toLowerCase();
  return ['done', 'complete', 'completed', 'مكتملة', 'تم', 'منجزة'].some((word) => normalized.includes(word));
}
