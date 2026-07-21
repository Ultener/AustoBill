import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from '../components/Logo';
import { notificationsApi } from '../store';

const navMain = [
  { to: '/dashboard/home', icon: 'fa-home', label: 'Главная' },
  { to: '/dashboard/servers', icon: 'fa-server', label: 'Мои серверы' },
  { to: '/dashboard/purchase', icon: 'fa-cart-plus', label: 'Купить сервер' },
];

const navFinance = [{ to: '/dashboard/topup', icon: 'fa-wallet', label: 'Пополнить баланс' }];

const navSupport = [
  { to: '/dashboard/tickets', icon: 'fa-ticket', label: 'Тикеты' },
  { to: '/dashboard/reviews', icon: 'fa-star', label: 'Отзывы' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isAdmin = user?.role === 'admin' || user?.isAdmin;
  const isStaff = isAdmin || user?.role === 'support';
  const [ticketNotices, setTicketNotices] = useState<{ id: string; subject: string }[]>([]);
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    if (!user || isStaff) {
      setTicketNotices([]);
      return;
    }
    notificationsApi.get()
      .then(d => setTicketNotices(d.ticketReplies || []))
      .catch(() => setTicketNotices([]));
  }, [user, isStaff, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const renderLink = (item: { to: string; icon: string; label: string }) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={closeMobile}
      className={({ isActive }) => `dash-nav-link${isActive ? ' active' : ''}`}
    >
      <i className={`fas ${item.icon}`} />
      <span>{item.label}</span>
    </NavLink>
  );

  const Sep = () => <div style={{ height: 1, background: 'var(--border-dim)', margin: '16px 10px' }} />;
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="ac-label" style={{ padding: '0 10px 10px' }}>
      {children}
    </div>
  );

  return (
    <div className="dash-layout">
      {isMobile && (
        <div className="dash-mobile-bar">
          <Logo to="/dashboard/home" size={28} showText />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ac-btn ac-btn-ghost"
            style={{ padding: '8px 12px' }}
            aria-label="Меню"
          >
            <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`} />
          </button>
        </div>
      )}

      <aside
        className={`dash-sidebar${isMobile && !mobileOpen ? ' is-mobile-closed' : ''}${isMobile && mobileOpen ? ' open' : ''}`}
      >
        <div style={{ padding: '22px 20px', borderBottom: '1px solid var(--border-dim)' }}>
          <Logo to="/" size={32} />
        </div>

        <nav style={{ flex: 1, padding: '18px 14px', overflowY: 'auto' }}>
          <Label>Основное</Label>
          {navMain.map(renderLink)}
          <Sep />
          <Label>Финансы</Label>
          {navFinance.map(renderLink)}
          <Sep />
          <Label>Поддержка</Label>
          {navSupport.map(renderLink)}
          {isStaff && (
            <>
              <Sep />
              <Label>Управление</Label>
              {renderLink({
                to: '/dashboard/admin',
                icon: 'fa-shield-halved',
                label: user?.role === 'support' ? 'Тикеты (саппорт)' : 'Админ панель',
              })}
            </>
          )}
        </nav>

        <div ref={profileRef} className="dash-profile">
          <button
            type="button"
            onClick={() => setProfileMenuOpen(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            <div className="dash-avatar">{user?.username?.charAt(0).toUpperCase() || 'U'}</div>
            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.username || 'Гость'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {user?.balance?.toLocaleString()} ₽
              </div>
            </div>
            <i
              className={`fas fa-chevron-${profileMenuOpen ? 'up' : 'down'}`}
              style={{ fontSize: 11, color: 'var(--text-dim)' }}
            />
          </button>

          <AnimatePresence>
            {profileMenuOpen && (
              <motion.div
                className="dash-profile-menu"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
              >
                <NavLink
                  to="/dashboard/settings"
                  className="dash-profile-item"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <i className="fas fa-gear" style={{ width: 18 }} />
                  Настройки
                </NavLink>
                <button type="button" className="dash-profile-item" onClick={handleLogout}>
                  <i className="fas fa-sign-out-alt" style={{ width: 18 }} />
                  Выход
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <main className="dash-main">
        <AnimatePresence>
          {ticketNotices.length > 0 && !location.pathname.startsWith('/dashboard/tickets') && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                margin: isMobile ? '12px 16px 0' : '16px 24px 0',
                padding: '14px 18px',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#fff' }}>
                <i className="fas fa-envelope-open-text" style={{ color: '#fbbf24' }} />
                <span>
                  {ticketNotices.length === 1
                    ? `Ответ по тикету: «${ticketNotices[0].subject}»`
                    : `Новые ответы в ${ticketNotices.length} тикетах`}
                </span>
              </div>
              <Link
                to="/dashboard/tickets"
                className="ac-btn ac-btn-primary"
                style={{ padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}
              >
                Перейти к тикету
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        <Outlet />
      </main>

      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={closeMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 150,
            border: 'none',
            cursor: 'pointer',
          }}
        />
      )}
    </div>
  );
}
