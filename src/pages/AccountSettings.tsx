import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { authApi } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader, BillingCard, BillingAlert } from '../components/billing/DashboardUI';
import { BillField, BillInput, BillFormGrid } from '../components/billing/BillForm';

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [idCopied, setIdCopied] = useState(false);

  // 2FA состояния
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  const [twoFactorPassword, setTwoFactorPassword] = useState('');

  // Модалки для 2FA
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordFor2FA, setPasswordFor2FA] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorQR, setTwoFactorQR] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [qrError, setQrError] = useState('');

  // Адаптивность
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    authApi.twoFactorStatus().then(res => {
      setTwoFactorEnabled(res.enabled);
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setMsg(''); setErr('');
    try {
      await authApi.updateProfile({ username: newUsername, email: newEmail });
      await refreshUser();
      setMsg('Профиль успешно обновлён');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка при сохранении');
    }
  };

  const changePassword = async () => {
    setMsg(''); setErr('');
    if (newPassword.length < 6) {
      setErr('Новый пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Пароли не совпадают');
      return;
    }
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMsg('Пароль успешно изменён');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка при смене пароля');
    }
  };

  // Шаг 1: запросить пароль
  const requestTwoFactorEnable = () => {
    setPasswordError('');
    setPasswordFor2FA('');
    setShowPasswordModal(true);
  };

  // Шаг 2: проверить пароль и сгенерировать 2FA, затем открыть модалку с QR
  const confirmTwoFactorEnable = async () => {
    if (!passwordFor2FA) {
      setPasswordError('Введите текущий пароль');
      return;
    }
    setPasswordError('');
    try {
      const res = await authApi.twoFactorEnable(passwordFor2FA);
      setTwoFactorSecret(res.secret);
      setTwoFactorQR(res.otpauth_url);
      setShowPasswordModal(false);
      setPasswordFor2FA('');
      setShowQRModal(true);
      setTwoFactorCode('');
      setQrError('');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Неверный пароль');
    }
  };

  // Подтверждение 2FA (ввод кода из приложения)
  const verifyTwoFactor = async () => {
    if (!twoFactorCode) {
      setQrError('Введите код из приложения');
      return;
    }
    setQrError('');
    try {
      await authApi.twoFactorVerify(twoFactorCode);
      setTwoFactorEnabled(true);
      setShowQRModal(false);
      setTwoFactorSecret('');
      setTwoFactorCode('');
      setMsg('2FA успешно включена');
      refreshUser();
    } catch (e) {
      setQrError(e instanceof Error ? e.message : 'Неверный код');
    }
  };

  const disableTwoFactor = async () => {
    if (!twoFactorPassword) {
      setErr('Введите пароль');
      return;
    }
    setErr('');
    try {
      await authApi.twoFactorDisable(twoFactorPassword);
      setTwoFactorEnabled(false);
      setTwoFactorPassword('');
      setMsg('2FA отключена');
      refreshUser();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Неверный пароль');
    }
  };

  const copySecretToClipboard = () => {
    navigator.clipboard.writeText(twoFactorSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const copyIdToClipboard = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id).then(() => {
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      }).catch(() => {
        setErr('Не удалось скопировать ID');
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  const roleLabel =
    user?.role === 'admin' ? 'Администратор' : user?.role === 'support' ? 'Поддержка' : 'Пользователь';

  return (
    <motion.div
      className="bill-profile-page bill-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <PageHeader label="Аккаунт" title="Профиль" subtitle="Данные, безопасность и двухфакторная аутентификация" />

      <motion.div variants={itemVariants} className="bill-profile-hero">
        <div className="bill-profile-hero__avatar">
          {(user?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="bill-profile-hero__name">{user?.username || 'Пользователь'}</h2>
          <p className="bill-profile-hero__meta">
            {user?.email} · {roleLabel}
          </p>
          <div className="bill-profile-hero__tags">
            <span className="bill-profile-tag">
              <i className="fas fa-calendar-alt" />
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
            </span>
            <span className="bill-profile-tag" onClick={copyIdToClipboard} role="button" tabIndex={0}>
              <i className="fas fa-fingerprint" />
              ID {user?.id ? String(user.id).slice(0, 10) + '…' : '—'}
              {idCopied ? <i className="fas fa-check" style={{ color: '#34d399' }} /> : <i className="fas fa-copy" />}
            </span>
            <span className="bill-profile-tag">
              <i className="fas fa-coins" />
              {user?.balance?.toLocaleString()} ₽
            </span>
          </div>
        </div>
      </motion.div>

      {msg && <BillingAlert type="success"><i className="fas fa-check-circle" /> {msg}</BillingAlert>}
      {err && <BillingAlert type="error"><i className="fas fa-exclamation-circle" /> {err}</BillingAlert>}

      <motion.div variants={itemVariants} className="bill-profile-section">
        <BillingCard>
          <div className="bill-profile-section__head">
            <i className="fas fa-user-edit" />
            <h3>Основная информация</h3>
          </div>
          <BillFormGrid cols={2}>
            <BillField label="Имя пользователя">
              <BillInput icon="fa-user" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            </BillField>
            <BillField label="Электронная почта">
              <BillInput icon="fa-envelope" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </BillField>
          </BillFormGrid>
          <button type="button" className="ac-btn ac-btn-primary" style={{ marginTop: 20 }} onClick={saveProfile}>
            <i className="fas fa-save" /> Сохранить
          </button>
        </BillingCard>
      </motion.div>

      <motion.div variants={itemVariants} className="bill-profile-section">
        <BillingCard>
          <div className="bill-profile-section__head">
            <i className="fas fa-lock" />
            <h3>Смена пароля</h3>
          </div>
          <BillField label="Текущий пароль">
            <BillInput icon="fa-lock" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </BillField>
          <BillFormGrid cols={2}>
            <BillField label="Новый пароль">
              <BillInput icon="fa-key" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </BillField>
            <BillField label="Подтверждение">
              <BillInput icon="fa-check-double" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </BillField>
          </BillFormGrid>
          <button type="button" className="ac-btn ac-btn-primary" style={{ marginTop: 20 }} onClick={changePassword}>
            <i className="fas fa-key" /> Обновить пароль
          </button>
        </BillingCard>
      </motion.div>

      <motion.div variants={itemVariants} className="bill-profile-section">
        <BillingCard>
          <div className="bill-profile-section__head">
            <i className="fas fa-shield-alt" />
            <h3>Двухфакторная аутентификация</h3>
          </div>

              {!twoFactorEnabled ? (
                <div>
                  <p style={{
                    marginBottom: 24,
                    color: 'var(--text-gray)',
                    fontSize: isMobile ? 13 : 14,
                    lineHeight: 1.6,
                  }}>
                    Защитите свой аккаунт с помощью двухфакторной аутентификации...
                  </p>
                  <button type="button" className="ac-btn ac-btn-primary" onClick={requestTwoFactorEnable}>
                    <i className="fas fa-qrcode" /> Включить 2FA
                  </button>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      background: 'rgba(52,211,153,0.1)',
                      border: '1px solid rgba(52,211,153,0.2)',
                      borderRadius: 24,
                      padding: isMobile ? '12px' : '16px',
                      marginBottom: 24,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <i className="fas fa-check-circle" style={{ color: '#34d399', fontSize: 24 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>2FA включена</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        Ваш аккаунт защищён.
                      </div>
                    </div>
                  </div>
                  <BillField label="Пароль для отключения">
                    <BillInput
                      icon="fa-lock"
                      type="password"
                      value={twoFactorPassword}
                      onChange={e => setTwoFactorPassword(e.target.value)}
                    />
                  </BillField>
                  <button type="button" className="ac-btn ac-btn-ghost" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.35)' }} onClick={disableTwoFactor}>
                    <i className="fas fa-times" /> Отключить 2FA
                  </button>
                </div>
              )}
        </BillingCard>
      </motion.div>

      {/* Примечание о безопасности */}
      <motion.div
        variants={itemVariants}
        style={{
          marginTop: 24,
          padding: isMobile ? '12px 16px' : '16px 20px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <i className="fas fa-shield-alt" style={{ fontSize: 24, color: '#ffffff' }} />
        <p style={{ fontSize: isMobile ? 12 : 13, color: 'var(--text-gray)', margin: 0, lineHeight: 1.5 }}>
          Для дополнительной защиты рекомендуется использовать сложный пароль и двухфакторную аутентификацию...
        </p>
      </motion.div>

      {/* Модалка для ввода пароля перед включением 2FA */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0f1117',
                borderRadius: 32,
                padding: isMobile ? '24px' : '32px',
                maxWidth: 400,
                width: '90%',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            >
              <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, marginBottom: 16, color: '#fff' }}>
                Подтверждение
              </h2>
              <p style={{ marginBottom: 20, color: 'var(--text-dim)', fontSize: isMobile ? 13 : 14 }}>
                Для включения двухфакторной аутентификации введите ваш текущий пароль.
              </p>
              {passwordError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 20,
                    marginBottom: 16,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                    fontSize: 13,
                  }}
                >
                  <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} />
                  {passwordError}
                </div>
              )}
              <input
                type="password"
                placeholder="Введите текущий пароль"
                value={passwordFor2FA}
                onChange={e => setPasswordFor2FA(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  color: '#fff',
                  marginBottom: 24,
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    borderRadius: 30,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Отмена
                </button>
                <button
                  onClick={confirmTwoFactorEnable}
                  style={{
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    borderRadius: 30,
                    background: '#ffffff',
                    border: 'none',
                    color: '#000',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  Подтвердить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модалка с QR‑кодом и подтверждением 2FA */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0f1117',
                borderRadius: 32,
                padding: isMobile ? '24px' : '32px',
                maxWidth: 500,
                width: '90%',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            >
              <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, marginBottom: 16, color: '#fff' }}>
                Настройка 2FA
              </h2>
              <p style={{ marginBottom: 16, color: 'var(--text-dim)', fontSize: isMobile ? 13 : 14 }}>
                Отсканируйте QR-код в приложении...
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#fff',
                    borderRadius: 20,
                    display: 'inline-block',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                  }}
                >
                  <QRCodeSVG
                    value={twoFactorQR}
                    size={isMobile ? 180 : 220}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '14px 18px',
                  borderRadius: 20,
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'monospace',
                  fontSize: isMobile ? 14 : 16,
                  letterSpacing: '1px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span>{twoFactorSecret.match(/.{1,4}/g)?.join(' ') || twoFactorSecret}</span>
                <button
                  onClick={copySecretToClipboard}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '6px 12px',
                    borderRadius: 30,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {secretCopied ? <i className="fas fa-check" /> : <i className="fas fa-copy" />}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
                Если сканирование не работает, введите этот ключ вручную в приложении.
              </p>
              {qrError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 20,
                    marginBottom: 16,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                    fontSize: 13,
                  }}
                >
                  <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} />
                  {qrError}
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>
                  Код из приложения
                </label>
                <input
                  className="form-input"
                  placeholder="6-значный код"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 20,
                    color: '#fff',
                  }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setTwoFactorSecret('');
                    setTwoFactorQR('');
                  }}
                  style={{
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    borderRadius: 30,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={verifyTwoFactor}
                  style={{
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    borderRadius: 30,
                    background: '#ffffff',
                    border: 'none',
                    color: '#000',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  Подтвердить и включить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}