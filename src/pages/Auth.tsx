import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { authApi, ApiError, type BanInfo } from '../store';
import ReCAPTCHA from 'react-google-recaptcha';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '../components/Logo';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Luminarix';
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const recaptchaEnabled = !!recaptchaSiteKey;

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

// Функция валидации имени пользователя
const validateUsername = (username: string): boolean => {
  if (username.length < 3 || username.length > 30) return false;
  const regex = /^[a-zA-Zа-яА-ЯёЁ0-9_.#-]+$/;
  return regex.test(username);
};

// Функция проверки сложности пароля
const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Пароль должен содержать минимум 8 символов' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, message: 'Пароль должен содержать хотя бы одну букву' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Пароль должен содержать хотя бы одну цифру' };
  }
  return { valid: true, message: '' };
};

// Компонент индикатора сложности пароля
const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const strengthText = ['Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'][strength] || 'Слабый';
  const strengthColor = ['#ef4444', '#f59e0b', '#fbbf24', '#34d399', '#10b981'][strength] || '#ef4444';
  const width = `${(strength + 1) * 20}%`;

  if (!password) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Сложность пароля:</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: strengthColor }}>{strengthText}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.3 }}
          style={{ height: '100%', background: strengthColor, borderRadius: 2 }}
        />
      </div>
    </div>
  );
};

export default function Auth({ mode }: { mode: AuthMode }) {
  const { user, setUser, setToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('auth-route');
    return () => document.documentElement.classList.remove('auth-route');
  }, []);

  useEffect(() => {
    const ban = (location.state as { ban?: BanInfo } | null)?.ban;
    if (ban?.reason) setBanInfo(ban);
  }, [location.state]);

  const handleAuthError = (err: unknown) => {
    if (err instanceof ApiError && err.ban) {
      setBanInfo(err.ban);
      setError('');
      return;
    }
    setBanInfo(null);
    setError(err instanceof Error ? err.message : 'Ошибка');
  };

  const [regStep, setRegStep] = useState(0);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [loginRecaptchaToken, setLoginRecaptchaToken] = useState('');
  const [regRecaptchaToken, setRegRecaptchaToken] = useState('');
  const loginRecaptchaRef = useRef<ReCAPTCHA>(null);
  const regRecaptchaRef = useRef<ReCAPTCHA>(null);

  const resetLoginRecaptcha = () => {
    setLoginRecaptchaToken('');
    loginRecaptchaRef.current?.reset();
  };

  const resetRegRecaptcha = () => {
    setRegRecaptchaToken('');
    regRecaptchaRef.current?.reset();
  };

  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Состояния для показа/скрытия пароля
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  if (user) return <Navigate to="/dashboard" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBanInfo(null);
    if (!email || !password) {
      setError('Заполните все поля');
      return;
    }
    if (recaptchaEnabled && !loginRecaptchaToken) {
      setError('Пожалуйста, подтвердите, что вы не робот');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.login(email, password, loginRecaptchaToken);
      if (data.require2FA) {
        setTwoFactorStep(true);
        setTempToken(data.tempToken);
        resetLoginRecaptcha();
      } else {
        setToken(data.token);
        setUser(data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      handleAuthError(err);
      resetLoginRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.twoFactorVerifyLogin(tempToken, twoFactorCode);
      setToken(data.token);
      setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }

    if (password !== confirmPw) {
      setError('Пароли не совпадают');
      return;
    }
    if (!regRecaptchaToken) {
      setError('Пожалуйста, подтвердите, что вы не робот');
      return;
    }
    setLoading(true);
    try {
      const ref = searchParams.get('ref') || undefined;
      const res = await authApi.register(username, email, password, regRecaptchaToken, ref);
      setMessage(res.message || 'Регистрация успешна. Проверьте почту для подтверждения.');
      setRegisteredEmail(email);
      setRegStep(3);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
      resetRegRecaptcha();
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verify(registeredEmail || email, verificationCode);
      setMessage(res.message || 'Email подтверждён. Теперь вы можете войти.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Неверный код');
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Введите email');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgot(email);
      setMessage(res.message || 'Код отправлен на почту');
      setTimeout(() => navigate(`/reset?email=${encodeURIComponent(email)}`), 1500);
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !resetCode || !newPassword) {
      setError('Заполните все поля');
      return;
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.reset(email, resetCode, newPassword);
      setMessage(res.message || 'Пароль изменён. Теперь вы можете войти.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    }
    setLoading(false);
  };

  const nextRegStep = () => {
    setError('');
    if (regStep === 0) {
      if (!username.trim() || username.trim().length < 3) {
        setError('Имя минимум 3 символа');
        return;
      }
      if (!validateUsername(username)) {
        setError('Имя может содержать только буквы, цифры, _, ., -, #');
        return;
      }
      if (recaptchaEnabled && !regRecaptchaToken) {
        setError('Пожалуйста, подтвердите, что вы не робот');
        return;
      }
      setRegStep(1);
    } else if (regStep === 1) {
      if (!email.trim() || !email.includes('@')) {
        setError('Введите корректный email');
        return;
      }
      setRegStep(2);
    }
  };

  const renderContent = () => {
    if (twoFactorStep) {
      return (
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onSubmit={handleTwoFactorVerify}
        >
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-key" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Код из Google Authenticator
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="6-значный код"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <i className="fas fa-shield-alt" style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--blue-3)',
                opacity: 0.5,
                fontSize: 14
              }} />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-fill"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px 28px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> Проверка...</>
            ) : (
              <><i className="fas fa-check" /> Подтвердить</>
            )}
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setTwoFactorStep(false);
                setTempToken('');
                setTwoFactorCode('');
                resetLoginRecaptcha();
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <i className="fas fa-arrow-left" /> Назад
            </button>
          </div>
        </motion.form>
      );
    }

    if (mode === 'register') {
      if (regStep === 3) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-envelope" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Код из письма
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  placeholder="6-значный код"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <i className="fas fa-envelope-open-text" style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--blue-3)',
                  opacity: 0.5,
                  fontSize: 14
                }} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleVerify}
              className="btn btn-fill"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '14px 28px' }}
            >
              {loading ? <><i className="fas fa-spinner fa-spin" /> Проверка...</> : <><i className="fas fa-check" /> Подтвердить</>}
            </button>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setRegStep(2)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <i className="fas fa-arrow-left" /> Назад
              </button>
            </div>
          </motion.div>
        );
      }
      if (regStep === 0) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-user" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Имя пользователя
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  placeholder="Ваш никнейм"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <i className="fas fa-user-circle" style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--blue-3)',
                  opacity: 0.5,
                  fontSize: 14
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                Только буквы, цифры, _, ., -
              </div>
            </div>
            {recaptchaEnabled && (
              <div style={{ 
                marginBottom: 16,
                transform: isMobile ? 'scale(0.9)' : 'scale(1)',
                transformOrigin: 'left center'
              }}>
                <ReCAPTCHA
                  ref={regRecaptchaRef}
                  sitekey={recaptchaSiteKey}
                  onChange={(token) => setRegRecaptchaToken(token || '')}
                  onExpired={resetRegRecaptcha}
                  theme="dark"
                />
              </div>
            )}
            <button
              type="button"
              onClick={nextRegStep}
              disabled={recaptchaEnabled && !regRecaptchaToken}
              className="btn btn-fill"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px 28px',
                opacity: recaptchaEnabled && !regRecaptchaToken ? 0.7 : 1,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              Далее <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </motion.div>
        );
      }
      if (regStep === 1) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-envelope" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Электронная почта
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <i className="fas fa-at" style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--blue-3)',
                  opacity: 0.5,
                  fontSize: 14
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                type="button"
                onClick={() => { setError(''); setRegStep(0); }}
                className="btn btn-ghost"
                style={{ 
                  flex: 1, 
                  justifyContent: 'center', 
                  padding: '14px 20px',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                <i className="fas fa-arrow-left" /> Назад
              </button>
              <button
                type="button"
                onClick={nextRegStep}
                className="btn btn-fill"
                style={{ 
                  flex: 2, 
                  justifyContent: 'center', 
                  padding: '14px 20px',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                Далее <i className="fas fa-arrow-right" />
              </button>
            </div>
          </motion.div>
        );
      }
      if (regStep === 2) {
        return (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleRegister}
          >
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-lock" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Пароль
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Минимум 8 символов, буквы и цифры"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <i
                  className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--blue-3)',
                    opacity: 0.5,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                />
              </div>
              <PasswordStrengthIndicator password={password} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-check-double" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Повторите пароль
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Ещё раз..."
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <i
                  className={`fas fa-${showConfirmPassword ? 'eye-slash' : 'eye'}`}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--blue-3)',
                    opacity: 0.5,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                type="button"
                onClick={() => { setError(''); setRegStep(1); }}
                className="btn btn-ghost"
                style={{ 
                  flex: 1, 
                  justifyContent: 'center', 
                  padding: '14px 20px',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                <i className="fas fa-arrow-left" /> Назад
              </button>
              <button
                type="submit"
                className="btn btn-fill"
                disabled={loading}
                style={{ 
                  flex: 2, 
                  justifyContent: 'center', 
                  padding: '14px 20px',
                  opacity: loading ? 0.7 : 1,
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                {loading ? <><i className="fas fa-spinner fa-spin" /></> : <><i className="fas fa-user-plus" /> Создать</>}
              </button>
            </div>
          </motion.form>
        );
      }
    }

    if (mode === 'login') {
      return (
        <AnimatePresence mode="wait">
          <motion.form
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleLogin}
          >
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-envelope" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Электронная почта
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <i className="fas fa-at" style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--blue-3)',
                  opacity: 0.5,
                  fontSize: 14
                }} />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-lock" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
                Пароль
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <i
                  className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--blue-3)',
                    opacity: 0.5,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
            {recaptchaEnabled && (
              <div style={{ 
                marginBottom: 16,
                transform: isMobile ? 'scale(0.9)' : 'scale(1)',
                transformOrigin: 'left center'
              }}>
                <ReCAPTCHA
                  ref={loginRecaptchaRef}
                  sitekey={recaptchaSiteKey}
                  onChange={(token) => setLoginRecaptchaToken(token || '')}
                  onExpired={resetLoginRecaptcha}
                  theme="dark"
                />
              </div>
            )}
            <button
              type="submit"
              className="btn btn-fill"
              disabled={loading || (recaptchaEnabled && !loginRecaptchaToken)}
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: 8,
                padding: '14px 28px',
                opacity: loading || (recaptchaEnabled && !loginRecaptchaToken) ? 0.7 : 1,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {loading ? <><i className="fas fa-spinner fa-spin" /> Входим...</> : <><i className="fas fa-arrow-right" /> Войти</>}
            </button>
          </motion.form>
        </AnimatePresence>
      );
    }

    if (mode === 'forgot') {
      return (
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onSubmit={handleForgot}
        >
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-envelope" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Электронная почта
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <i className="fas fa-at" style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--blue-3)',
                opacity: 0.5,
                fontSize: 14
              }} />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-fill"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 28px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <><i className="fas fa-spinner fa-spin" /> Отправка...</> : <><i className="fas fa-paper-plane" /> Отправить код</>}
          </button>
          <div style={{ marginTop: 12 }}>
            <Link to="/login" className="btn btn-ghost" style={{ display: 'block', textAlign: 'center', padding: '14px' }}>
              <i className="fas fa-arrow-left" /> Вернуться ко входу
            </Link>
          </div>
        </motion.form>
      );
    }

    if (mode === 'reset') {
      return (
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onSubmit={handleReset}
        >
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-envelope" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Электронная почта
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <i className="fas fa-at" style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--blue-3)',
                opacity: 0.5,
                fontSize: 14
              }} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-key" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Код из письма
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="6-значный код"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <i className="fas fa-envelope-open-text" style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--blue-3)',
                opacity: 0.5,
                fontSize: 14
              }} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-lock" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Новый пароль
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Минимум 8 символов, буквы и цифры"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <i
                className={`fas fa-${showNewPassword ? 'eye-slash' : 'eye'}`}
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--blue-3)',
                  opacity: 0.5,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              />
            </div>
            <PasswordStrengthIndicator password={newPassword} />
          </div>
          <button
            type="submit"
            className="btn btn-fill"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 28px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <><i className="fas fa-spinner fa-spin" /> Сохраняем...</> : <><i className="fas fa-save" /> Сменить пароль</>}
          </button>
          <div style={{ marginTop: 12 }}>
            <Link to="/login" className="btn btn-ghost" style={{ display: 'block', textAlign: 'center', padding: '14px' }}>
              <i className="fas fa-arrow-left" /> Вернуться ко входу
            </Link>
          </div>
        </motion.form>
      );
    }

    if (mode === 'verify') {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-envelope" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Электронная почта
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <i className="fas fa-at" style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--blue-3)',
                opacity: 0.5,
                fontSize: 14
              }} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-key" style={{ fontSize: 11, color: 'var(--blue-3)' }} />
              Код из письма
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="6-значный код"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <i className="fas fa-envelope-open-text" style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--blue-3)',
                opacity: 0.5,
                fontSize: 14
              }} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            className="btn btn-fill"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 28px' }}
          >
            {loading ? <><i className="fas fa-spinner fa-spin" /> Проверка...</> : <><i className="fas fa-check" /> Подтвердить</>}
          </button>
          <div style={{ marginTop: 12 }}>
            <Link to="/login" className="btn btn-ghost" style={{ display: 'block', textAlign: 'center', padding: '14px' }}>
              <i className="fas fa-arrow-left" /> Вернуться ко входу
            </Link>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  let title = '';
  let subtitle = '';
  if (mode === 'login') {
    title = 'Вход в аккаунт';
    subtitle = 'Введите данные для входа';
  } else if (mode === 'register') {
    if (regStep === 3) {
      title = 'Подтверждение email';
      subtitle = 'Введите код из письма';
    } else {
      title = 'Регистрация';
      subtitle = `Шаг ${regStep + 1} из 3`;
    }
  } else if (mode === 'forgot') {
    title = 'Восстановление пароля';
    subtitle = 'Введите email для получения кода';
  } else if (mode === 'reset') {
    title = 'Сброс пароля';
    subtitle = 'Введите код и новый пароль';
  } else if (mode === 'verify') {
    title = 'Подтверждение email';
    subtitle = 'Введите код из письма';
  }

  return (
    <div className="auth-page">
      <div className="auth-page__grid" aria-hidden />

      <aside className="auth-aside">
        <div className="auth-aside__logo">
          <Logo to="/" size={40} showText />
        </div>
        <h2 className="auth-aside__title">Хостинг без лишней суеты</h2>
        <p className="auth-aside__text">
          {APP_NAME} — панель для игровых, кодинг и VDS серверов. Быстрый запуск, прозрачные тарифы и поддержка в один клик.
        </p>
        <div className="auth-aside__stats">
          <div className="auth-aside__stat">
            <strong>99.9%</strong>
            <span>Аптайм</span>
          </div>
          <div className="auth-aside__stat">
            <strong>24/7</strong>
            <span>Поддержка</span>
          </div>
        </div>
        {[
          { icon: 'server', text: 'Управление серверами в одном месте' },
          { icon: 'shield-halved', text: 'DDoS-защита и стабильные ноды' },
          { icon: 'headset', text: 'Тикеты и быстрые ответы' },
          { icon: 'chart-line', text: 'Мониторинг и автопродление' },
        ].map(feat => (
          <div key={feat.icon} className="auth-feature">
            <i className={`fas fa-${feat.icon}`} />
            <span>{feat.text}</span>
          </div>
        ))}
      </aside>

      <div className="auth-form-panel">
        <div className="auth-form-panel__scroll">
        <div className="auth-form-panel__inner">
          <div className="auth-form-panel__logo">
            <Logo to="/" size={36} showText />
          </div>

          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="sub"
          >
            {subtitle}
          </motion.p>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="form-success"
                style={{
                  background: 'rgba(52,211,153,.1)',
                  border: '1px solid rgba(52,211,153,.2)',
                  color: '#34d399',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <i className="fas fa-check-circle" />
                {message}
              </motion.div>
            )}

            {banInfo && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="auth-ban-notice"
                style={{
                  background: 'rgba(239,68,68,.12)',
                  border: '1px solid rgba(239,68,68,.35)',
                  borderRadius: 16,
                  padding: '20px 22px',
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <i className="fas fa-ban" style={{ color: '#ef4444', fontSize: 20 }} />
                  <strong style={{ color: '#fff', fontSize: 17 }}>Аккаунт заблокирован</strong>
                </div>
                <p style={{ margin: '0 0 10px', color: '#fca5a5', fontSize: 14, lineHeight: 1.5 }}>
                  <span style={{ color: '#a1a1aa' }}>Причина: </span>
                  {banInfo.reason}
                </p>
                <p style={{ margin: 0, color: '#71717a', fontSize: 13 }}>
                  {banInfo.byIp
                    ? 'Блокировка распространяется на аккаунт и IP последнего входа.'
                    : 'Блокировка только аккаунта (IP не заблокирован).'}
                </p>
                <p style={{ margin: '12px 0 0', color: '#52525b', fontSize: 12 }}>
                  Подробности отправлены на вашу почту.
                </p>
              </motion.div>
            )}

            {error && !banInfo && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="form-error"
                style={{
                  background: 'rgba(239,68,68,.1)',
                  border: '1px solid rgba(239,68,68,.2)',
                  color: '#ef4444',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <i className="fas fa-exclamation-circle" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>

          {mode === 'register' && regStep < 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="auth-link"
              style={{ marginTop: 20, textAlign: 'center' }}
            >
              Уже есть аккаунт? <Link to="/login" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Войти</Link>
            </motion.div>
          )}

          {mode === 'login' && (
            <>
              {/* Кнопка входа через Discord */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ marginTop: 20 }}
              >
                <a href="/api/auth/discord" className="btn auth-discord-btn">
                  <i className="fab fa-discord" style={{ fontSize: 18 }} />
                  Войти через Discord
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{ textAlign: 'center', marginTop: 16 }}
              >
                <Link to="/forgot" style={{ color: '#fff', fontSize: 13, textDecoration: 'none' }}>
                  Забыли пароль?
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="auth-link"
                style={{ marginTop: 16, textAlign: 'center' }}
              >
                Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
              </motion.div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}