import { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { serversApi, GameServer, referralsApi } from '../store';
import { Link } from 'react-router-dom';
import { StatGrid, StatCard } from '../components/billing/DashboardUI';
import { copyToClipboard } from '../utils/clipboard';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'AustoCloud';

const quickActions = [
  { to: '/dashboard/purchase', icon: 'fa-cart-plus', label: 'Купить сервер' },
  { to: '/dashboard/topup', icon: 'fa-coins', label: 'Пополнить баланс' },
  { to: '/dashboard/servers', icon: 'fa-server', label: 'Мои серверы' },
  { to: '/dashboard/reviews', icon: 'fa-star', label: 'Отзывы' },
  { to: '/dashboard/tickets', icon: 'fa-headset', label: 'Поддержка' },
];

export default function DashboardHome() {
  const { user } = useAuth();
  const [servers, setServers] = useState<GameServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralLink, setReferralLink] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralCopyError, setReferralCopyError] = useState('');

  useEffect(() => {
    serversApi
      .list()
      .then(setServers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    referralsApi
      .me()
      .then(d => {
        setReferralLink(d.link);
        setReferralCount(d.count);
      })
      .catch(() => {
        if (user?.id) setReferralLink(`https://austocloud.fun/register?ref=${user.id}`);
      });
  }, [user?.id]);

  const activeCount = servers.filter(s => s.status === 'active').length;

  const handleCopyReferralLink = async () => {
    const ok = await copyToClipboard(referralLink);
    if (ok) {
      setReferralCopyError('');
      setReferralCopied(true);
      window.setTimeout(() => setReferralCopied(false), 2500);
      return;
    }
    setReferralCopied(false);
    setReferralCopyError('Не удалось скопировать. Скопируйте ссылку из поля ниже.');
  };

  return (
    <div className="bill-page bill-page--fill">
      <div className="bill-page__head">
        <div className="bill-hero">
          <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, marginBottom: 8 }}>
            Привет, {user?.username || 'гость'}!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-gray)', margin: 0 }}>
            Добро пожаловать в личный кабинет {APP_NAME}. Рады видеть вас снова.
          </p>
        </div>

        <StatGrid>
          <StatCard icon="fa-server" label="Активные серверы" value={loading ? '…' : activeCount} />
          <StatCard
            icon="fa-coins"
            label="Баланс"
            value={`${user?.balance?.toLocaleString() ?? 0} ₽`}
            accent
          />
          <StatCard icon="fa-users" label="Рефералы" value={referralCount} />
        </StatGrid>

        {referralLink ? (
          <div style={{ marginTop: 16, maxWidth: '100%' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <input
                type="text"
                readOnly
                value={referralLink}
                className="form-input"
                aria-label="Реферальная ссылка"
                onFocus={e => e.target.select()}
                style={{
                  flex: '1 1 220px',
                  minWidth: 0,
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  color: 'var(--text-gray)',
                }}
              />
              <button
                type="button"
                className="ac-btn ac-btn-ghost"
                style={{ fontSize: 13, flexShrink: 0 }}
                onClick={handleCopyReferralLink}
              >
                <i className={`fas ${referralCopied ? 'fa-check' : 'fa-copy'}`} style={{ marginRight: 6 }} />
                {referralCopied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            {referralCopyError ? (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>{referralCopyError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="bill-page__body ac-card bill-home-actions" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Быстрые действия</h3>
        <div className="bill-home-actions__grid">
          {quickActions.map(btn => (
            <Link
              key={btn.to}
              to={btn.to}
              className="ac-btn ac-btn-ghost"
              style={{
                flexDirection: 'column',
                padding: '20px 12px',
                textDecoration: 'none',
                gap: 10,
                height: '100%',
                minHeight: 100,
              }}
            >
              <i className={`fas ${btn.icon}`} style={{ fontSize: 20 }} />
              <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{btn.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
