import React from 'react';
import {
  KanbanSquare,
  Link,
  MessageSquare,
  Moon,
  MoreVertical,
  Radar,
  Search,
  ShieldCheck,
  UsersRound,
  Wifi,
  Zap
} from 'lucide-react';

function TeamPage({
  userIsBoardOwner,
  isCreatingInvite,
  inviteLink,
  boardMembers,
  roleCounts,
  presenceUsers,
  teamRoleFilter,
  teamSearchQuery,
  filteredBoardMembers,
  onlineMemberIds,
  onlineMemberEmails,
  activeBoardTitle,
  roleLabels,
  updatingMemberRoleId,
  removingMemberId,
  onCreateInvite,
  onCopyInvite,
  onRoleFilterChange,
  onSearchChange,
  onUpdateMemberRole,
  onRemoveMember
}) {
  return (
    <section className="team-permissions-page" id="team" aria-label="إدارة الفريق والصلاحيات">
      <div className="team-hero">
        <div>
          <span className="invite-kicker">التواجد الحي والأدوار</span>
          <h3>إدارة الفريق والأعضاء المتصلين</h3>
          <p>تحكم في أدوار أعضاء اللوحة، راقب المتصلين الآن، ووزع صلاحيات العمل بين المالك والمسؤولين والأعضاء.</p>
        </div>
        <div className="team-actions">
          <button type="button" className="secondary-button">
            <Wifi size={17} />
            تصدير سجل التواجد
          </button>
          <button type="button" className="secondary-button">
            <ShieldCheck size={17} />
            مصفوفة الأدوار
          </button>
          {userIsBoardOwner ? (
            <button type="button" onClick={onCreateInvite} disabled={isCreatingInvite}>
              <UsersRound size={18} />
              {isCreatingInvite ? 'جاري إنشاء الدعوة...' : 'دعوة عضو جديد +'}
            </button>
          ) : null}
        </div>
      </div>

      {userIsBoardOwner && inviteLink ? (
        <div className="team-invite-link">
          <label>
            رابط الدعوة
            <input readOnly value={inviteLink} aria-label="رابط الدعوة" />
          </label>
          <button type="button" className="secondary-button" onClick={onCopyInvite}>
            <Link size={16} />
            نسخ الرابط
          </button>
        </div>
      ) : null}

      <div className="team-metrics">
        <article className="team-metric-card">
          <UsersRound size={26} />
          <span>إجمالي الفريق</span>
          <strong>{boardMembers.length}</strong>
          <small>{roleCounts.owner} مالك، {roleCounts.manager} مسؤول، {roleCounts.member} عضو</small>
        </article>
        <article className="team-metric-card live">
          <Zap size={26} />
          <span>نشط الآن</span>
          <strong>{presenceUsers.length}</strong>
          <small>مزامنة مباشرة عبر Socket.io</small>
        </article>
        <article className="team-metric-card">
          <ShieldCheck size={26} />
          <span>المسؤولون</span>
          <strong>{roleCounts.manager}</strong>
          <small>يمكنهم إضافة مهام داخل البطاقات</small>
        </article>
        <article className="team-metric-card muted">
          <Moon size={26} />
          <span>غير متصل</span>
          <strong>{Math.max(boardMembers.length - presenceUsers.length, 0)}</strong>
          <small>تظهر حالتهم عند العودة للوحة</small>
        </article>
      </div>

      <section className="team-radar" aria-label="رادار الحضور المباشر">
        <div className="team-radar-header">
          <div className="team-radar-icon"><Radar size={20} /></div>
          <div>
            <h4>رادار الحضور التشاركي المباشر</h4>
            <p>كل عضو متصل يظهر هنا فوراً، ويتم تحديث العدد مع فتح اللوحة في أكثر من نافذة.</p>
          </div>
          <span><span className="live-dot" /> WebSocket Live</span>
        </div>
        <div className="team-radar-grid">
          <article>
            <strong>مالك اللوحة</strong>
            <span>{roleCounts.owner} عضو</span>
            <p>ينشئ البطاقات، يدير الأعضاء، ويحدد المسؤولين.</p>
          </article>
          <article>
            <strong>المسؤولون</strong>
            <span>{roleCounts.manager} عضو</span>
            <p>ينشئون المهام الفرعية داخل البطاقات المسندة لهم ويوكلونها للأعضاء.</p>
          </article>
          <article>
            <strong>الأعضاء</strong>
            <span>{roleCounts.member} عضو</span>
            <p>ينفذون المهام المسندة لهم ويحدثون حالة الإنجاز.</p>
          </article>
        </div>
      </section>

      <div className="team-toolbar">
        <div className="team-tabs" role="tablist" aria-label="فلترة أعضاء الفريق">
          <button type="button" className={teamRoleFilter === 'all' ? 'active' : ''} onClick={() => onRoleFilterChange('all')}>
            الكل ({boardMembers.length})
          </button>
          <button type="button" className={teamRoleFilter === 'owner' ? 'active' : ''} onClick={() => onRoleFilterChange('owner')}>
            المالك ({roleCounts.owner})
          </button>
          <button type="button" className={teamRoleFilter === 'manager' ? 'active' : ''} onClick={() => onRoleFilterChange('manager')}>
            المسؤولون ({roleCounts.manager})
          </button>
          <button type="button" className={teamRoleFilter === 'member' ? 'active' : ''} onClick={() => onRoleFilterChange('member')}>
            الأعضاء ({roleCounts.member})
          </button>
        </div>
        <label className="team-search">
          <Search size={18} />
          <input value={teamSearchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="بحث بالاسم، البريد، أو الدور..." />
        </label>
      </div>

      <div className="team-table">
        <div className="team-table-head">
          <span>العضو والمعلومات</span>
          <span>الحالة اللحظية</span>
          <span>الدور والصلاحيات</span>
          <span>اللوحة الحالية</span>
          <span>إجراءات</span>
        </div>
        {filteredBoardMembers.length === 0 ? (
          <p className="team-empty">لا توجد نتائج مطابقة للبحث الحالي.</p>
        ) : (
          filteredBoardMembers.map((member) => {
            const isOnline = onlineMemberIds.has(member.id) || onlineMemberEmails.has(member.email);

            return (
              <article key={member.id} className="team-row">
                <div className="team-member-profile">
                  <span className="member-avatar">{member.name.slice(0, 2)}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.email}</small>
                  </div>
                </div>
                <span className={isOnline ? 'member-status online' : 'member-status'}>
                  <span className="live-dot" />
                  {isOnline ? 'متصل الآن ويعمل على اللوحة' : 'غير متصل حالياً'}
                </span>
                <div className="team-role-control">
                  <span className={`role-badge ${member.role}`}>{roleLabels[member.role] || roleLabels.member}</span>
                  {userIsBoardOwner && member.role !== 'owner' ? (
                    <select
                      className="role-select"
                      value={member.role}
                      onChange={(event) => onUpdateMemberRole(member.id, event.target.value)}
                      disabled={updatingMemberRoleId === member.id}
                      aria-label="تغيير دور العضو"
                    >
                      <option value="member">عضو</option>
                      <option value="manager">مسؤول</option>
                    </select>
                  ) : null}
                </div>
                <div className="team-current-board">
                  <KanbanSquare size={16} />
                  <span>{activeBoardTitle}</span>
                  <small>{isOnline ? 'نشط في هذه اللحظة' : 'آخر ظهور غير متاح'}</small>
                </div>
                <div className="team-row-actions">
                  <button type="button" className="icon-button" aria-label="تنبيه العضو">
                    <MessageSquare size={16} />
                  </button>
                  {userIsBoardOwner && member.role !== 'owner' ? (
                    <button
                      type="button"
                      className="danger-button small-button"
                      onClick={() => onRemoveMember(member.id)}
                      disabled={removingMemberId === member.id}
                    >
                      {removingMemberId === member.id ? '...' : 'إزالة'}
                    </button>
                  ) : (
                    <button type="button" className="icon-button" aria-label="خيارات العضو">
                      <MoreVertical size={16} />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default TeamPage;
