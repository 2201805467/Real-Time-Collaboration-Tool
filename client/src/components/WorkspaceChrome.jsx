import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ClipboardCheck,
  FolderKanban,
  KanbanSquare,
  LifeBuoy,
  Moon,
  Settings,
  Sun,
  UsersRound
} from 'lucide-react';
import UserAvatar from './UserAvatar.jsx';

function WorkspaceChrome({
  boards,
  selectedBoardId,
  activeSection,
  activeBoardTitle,
  boardMembersCount,
  workspaceStats,
  isConnected,
  presenceUsers,
  userIsBoardOwner,
  isDarkMode,
  notifications,
  unreadNotificationsCount,
  isLoadingNotifications,
  notificationsError,
  onBoardChange,
  onNavigate,
  onOpenNotification,
  onMarkAllNotificationsRead,
  onToggleTheme
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsMenuRef = useRef(null);

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!notificationsMenuRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen]);

  return (
    <>
      <aside className="workspace-sidebar" aria-label="Workspace navigation">
        <div className="brand-block">
          <div className="brand-mark secondary">ت</div>
          <div>
            <strong>تدفق</strong>
            <span>Tadafuq Cloud</span>
          </div>
        </div>

        <div className="workspace-switcher">
          <button type="button" className="switcher-arrows" aria-label="تبديل المشروع">
            ↕
          </button>
          <label>
            المشروع
            <select value={selectedBoardId || ''} onChange={(event) => onBoardChange(event.target.value)}>
              <option value="">نظرة عامة على المشاريع</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </select>
          </label>
          <div className="brand-mark">ت</div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-section-title">أقسام المشروع</span>
          <button type="button" className={activeSection === 'overview' ? 'active' : ''} onClick={() => onNavigate('overview')}>
            <FolderKanban className="nav-icon" size={20} aria-hidden="true" />
            نظرة عامة والمشاريع
          </button>
          <button
            type="button"
            className={activeSection === 'kanban' ? 'active' : ''}
            onClick={() => onNavigate('kanban')}
            disabled={!selectedBoardId}
          >
            <KanbanSquare className="nav-icon" size={20} aria-hidden="true" />
            لوحة الكانبان
          </button>
          <button
            type="button"
            className={activeSection === 'team' ? 'active' : ''}
            onClick={() => onNavigate('team')}
            disabled={!selectedBoardId}
          >
            <UsersRound className="nav-icon" size={20} aria-hidden="true" />
            إدارة الفريق والصلاحيات
            {boardMembersCount ? <span className="nav-badge">{boardMembersCount}</span> : null}
          </button>
          <button
            type="button"
            className={activeSection === 'task' ? 'active' : ''}
            onClick={() => onNavigate('task')}
            disabled={!selectedBoardId}
          >
            <ClipboardCheck className="nav-icon" size={20} aria-hidden="true" />
            تفاصيل المهمة والنشاط
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="storage-card">
            <div>
              <span>المساحة السحابية</span>
              <strong>{workspaceStats.storage.usedPercent}%</strong>
            </div>
            <div className="storage-track">
              <span style={{ width: `${workspaceStats.storage.usedPercent}%` }} />
            </div>
            <small>{workspaceStats.storage.usedLabel} / {workspaceStats.storage.limitLabel}</small>
          </div>
          <button type="button" className={activeSection === 'settings' ? 'active' : ''} onClick={() => onNavigate('settings')}>
            <Settings className="nav-icon" size={20} aria-hidden="true" />
            الإعدادات العامة
          </button>
          <button type="button">
            <LifeBuoy className="nav-icon" size={20} aria-hidden="true" />
            الدعم الفني والتوثيق
          </button>
          <button type="button" className={isDarkMode ? 'dark-toggle active' : 'dark-toggle'} onClick={onToggleTheme} aria-pressed={isDarkMode}>
            {isDarkMode ? <Sun className="nav-icon" size={20} aria-hidden="true" /> : <Moon className="nav-icon" size={20} aria-hidden="true" />}
            {isDarkMode ? 'الوضع الفاتح' : 'الوضع المظلم'}
            <span className="toggle-track"><span /></span>
          </button>
          <div className="socket-status">
            <span>Socket.io</span>
            <strong>{isConnected ? 'متصل الآن' : 'غير متصل'}</strong>
          </div>
        </div>
      </aside>

      <header className="workspace-topbar">
        <div>
          <span>المشاريع البرمجية</span>
          <strong>{activeBoardTitle}</strong>
        </div>
        <div className="topbar-actions">
          <div className="notifications-menu" ref={notificationsMenuRef}>
            <button
              type="button"
              className="notification-bell"
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label="الإشعارات"
              aria-expanded={notificationsOpen}
            >
              <Bell size={19} />
              {unreadNotificationsCount ? <span>{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span> : null}
            </button>
            {notificationsOpen ? (
              <section className="notifications-popover" aria-label="قائمة الإشعارات">
                <header>
                  <div><strong>الإشعارات</strong><small>{unreadNotificationsCount} غير مقروء</small></div>
                  <button type="button" onClick={onMarkAllNotificationsRead} disabled={!unreadNotificationsCount}>تحديد الكل كمقروء</button>
                </header>
                {notificationsError ? <p className="form-error">{notificationsError}</p> : null}
                <div className="notifications-list">
                  {isLoadingNotifications ? (
                    <p className="empty-state">جاري تحميل الإشعارات...</p>
                  ) : notifications.length === 0 ? (
                    <p className="empty-state">لا توجد إشعارات بعد.</p>
                  ) : notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={notification.isRead ? 'notification-item' : 'notification-item unread'}
                      onClick={() => {
                        onOpenNotification(notification);
                        setNotificationsOpen(false);
                      }}
                    >
                      <UserAvatar src={notification.actorAvatarUrl} name={notification.actorName || 'ن'} className="notification-avatar" />
                      <span>
                        <strong>{notification.message}</strong>
                        <small>{notification.boardTitle} · {new Date(notification.createdAt).toLocaleString('ar')}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <span className={isConnected ? 'live-pill online' : 'live-pill'}>مزامنة فورية</span>
          <div className="topbar-presence" title="الأعضاء المتصلون">
            <div className="topbar-avatars">
              {presenceUsers.slice(0, 3).map((presenceUser) => (
                <UserAvatar key={presenceUser.socketId} src={presenceUser.avatarUrl} name={presenceUser.name} />
              ))}
              {presenceUsers.length > 3 ? <span>+{presenceUsers.length - 3}</span> : null}
            </div>
            <span className="online-caption">متصل الآن</span>
          </div>
          <button type="button" className="secondary-button" onClick={() => onNavigate('kanban')}>
            تصفية
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onNavigate('share')}
            disabled={!selectedBoardId || !userIsBoardOwner}
          >
            مشاركة
          </button>
        </div>
      </header>
    </>
  );
}

export default WorkspaceChrome;
