import React, { useEffect, useState } from 'react';
import { Bell, KeyRound, Moon, Save, Sun, UserRound } from 'lucide-react';

export default function SettingsPage({
  user,
  isDarkMode,
  onToggleTheme,
  onSaveProfile,
  onSavePassword,
  onSaveNotificationPreferences
}) {
  const [profile, setProfile] = useState({ name: user.name, email: user.email });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [preferences, setPreferences] = useState(
    user.notificationPreferences || { assignments: true, comments: true }
  );
  const [savingSection, setSavingSection] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setProfile({ name: user.name, email: user.email });
    setPreferences(user.notificationPreferences || { assignments: true, comments: true });
  }, [user]);

  async function runSave(section, action, successMessage) {
    setSavingSection(section);
    setMessage({ type: '', text: '' });
    try {
      await action();
      setMessage({ type: 'success', text: successMessage });
      return true;
    } catch (error) {
      const translations = {
        'Email is already registered': 'هذا البريد الإلكتروني مستخدم في حساب آخر.',
        'Current password is incorrect': 'كلمة المرور الحالية غير صحيحة.',
        'New password must contain at least 6 characters': 'كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل.'
      };
      setMessage({ type: 'error', text: translations[error.message] || error.message });
      return false;
    } finally {
      setSavingSection('');
    }
  }

  async function submitProfile(event) {
    event.preventDefault();
    await runSave('profile', () => onSaveProfile(profile), 'تم تحديث بيانات الحساب.');
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'تأكيد كلمة المرور الجديدة غير مطابق.' });
      return;
    }
    const saved = await runSave('password', () => onSavePassword({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword
    }), 'تم تغيير كلمة المرور بنجاح.');
    if (saved) setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }

  async function submitPreferences(event) {
    event.preventDefault();
    await runSave(
      'preferences',
      () => onSaveNotificationPreferences(preferences),
      'تم حفظ تفضيلات الإشعارات.'
    );
  }

  return (
    <section className="settings-page" aria-label="الإعدادات العامة">
      <header className="settings-hero">
        <div><span>الحساب والتفضيلات</span><h2>الإعدادات العامة</h2><p>أدِر بيانات حسابك، الأمان، الإشعارات، ومظهر المنصة.</p></div>
        <div className="settings-avatar">{user.name.slice(0, 2)}</div>
      </header>

      {message.text ? <p className={message.type === 'error' ? 'form-error settings-message' : 'form-success settings-message'}>{message.text}</p> : null}

      <div className="settings-grid">
        <form className="settings-card" onSubmit={submitProfile}>
          <div className="settings-card-title"><span><UserRound size={19} /></span><div><h3>الملف الشخصي</h3><p>المعلومات التي تظهر لأعضاء فريقك.</p></div></div>
          <label>الاسم<input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} required /></label>
          <label>البريد الإلكتروني<input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} required /></label>
          <small>تاريخ إنشاء الحساب: {user.createdAt ? new Date(`${user.createdAt.replace(' ', 'T')}Z`).toLocaleDateString('ar-LY') : 'غير متاح'}</small>
          <button type="submit" disabled={savingSection === 'profile'}><Save size={17} />{savingSection === 'profile' ? 'جاري الحفظ...' : 'حفظ البيانات'}</button>
        </form>

        <form className="settings-card" onSubmit={submitPassword}>
          <div className="settings-card-title"><span><KeyRound size={19} /></span><div><h3>كلمة المرور</h3><p>استخدم كلمة مرور قوية لحماية حسابك.</p></div></div>
          <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} required /></label>
          <label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength="6" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} required /></label>
          <label>تأكيد كلمة المرور<input type="password" autoComplete="new-password" minLength="6" value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} required /></label>
          <button type="submit" disabled={savingSection === 'password'}><KeyRound size={17} />{savingSection === 'password' ? 'جاري التغيير...' : 'تغيير كلمة المرور'}</button>
        </form>

        <form className="settings-card" onSubmit={submitPreferences}>
          <div className="settings-card-title"><span><Bell size={19} /></span><div><h3>الإشعارات</h3><p>اختر الأحداث التي تريد تلقي إشعارات عنها.</p></div></div>
          <label className="settings-switch"><span><strong>التعيينات</strong><small>عند إسناد بطاقة أو مهمة فرعية إليك.</small></span><input type="checkbox" checked={preferences.assignments} onChange={(event) => setPreferences((current) => ({ ...current, assignments: event.target.checked }))} /></label>
          <label className="settings-switch"><span><strong>التعليقات</strong><small>عند إضافة تعليق إلى بطاقة مرتبطة بك.</small></span><input type="checkbox" checked={preferences.comments} onChange={(event) => setPreferences((current) => ({ ...current, comments: event.target.checked }))} /></label>
          <button type="submit" disabled={savingSection === 'preferences'}><Save size={17} />{savingSection === 'preferences' ? 'جاري الحفظ...' : 'حفظ التفضيلات'}</button>
        </form>

        <section className="settings-card">
          <div className="settings-card-title"><span>{isDarkMode ? <Moon size={19} /> : <Sun size={19} />}</span><div><h3>المظهر</h3><p>اختر المظهر المريح لك أثناء العمل.</p></div></div>
          <button type="button" className="settings-theme-button" onClick={onToggleTheme}>{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}{isDarkMode ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع المظلم'}</button>
          <small>يتم حفظ اختيارك ومزامنته بين نوافذ التطبيق.</small>
        </section>
      </div>
    </section>
  );
}
