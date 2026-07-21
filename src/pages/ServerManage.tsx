import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { GameServer, serversApi, pteroApi, Tariff, plansApi } from '../store';
import { calcRenewalCost, getRenewalDiscountRate } from '../lib/pricing';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PTERO_URL = 'https://panel.austocloud.fun';

const formatPrice = (price: number) => {
  return price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
};

// Компонент консоли (не используется в интерфейсе, но оставлен для возможных будущих фич)
function VpsConsole({ vmid, node }: { vmid: number | string; node: number | string }) {
  const [consoleUrl, setConsoleUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`/api/proxmox/vm/${vmid}/ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('lmx_token')}`,
          },
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Ошибка получения тикета');
        const novncUrl = `https://vm.austocloud.fun/?console=lxc&vmid=${vmid}&node=${node}&resize=scale&novnc=1&ticket=${encodeURIComponent(data.ticket)}`;
        setConsoleUrl(novncUrl);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [vmid, node]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><i className="fas fa-spinner fa-spin" /> Загрузка консоли...</div>;
  if (error) return <div style={{ color: '#ef4444', padding: 20 }}>Ошибка: {error}</div>;
  if (!consoleUrl) return <div>Не удалось открыть консоль</div>;

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      <iframe
        src={consoleUrl}
        style={{ width: '100%', height: '600px', border: 'none' }}
        allow="clipboard-read; clipboard-write"
        title="VDS Console"
      />
    </div>
  );
}

export default function ServerManage() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState<GameServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [autoRenew, setAutoRenew] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);
  const [showConfirmChange, setShowConfirmChange] = useState<Tariff | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'renewal' | 'changeTariff' | 'danger'>('overview');

  // Для отображения пароля Pterodactyl
  const [showPteroCreds, setShowPteroCreds] = useState(false);
  const [pteroLogin, setPteroLogin] = useState('');
  const [pteroPassword, setPteroPassword] = useState('');
  const [credsLoading, setCredsLoading] = useState(false);

  // Адаптивность
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (id) {
      serversApi.get(id)
        .then(data => {
          setServer(data);
          setAutoRenew(data.autoRenew || false);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    plansApi.list().then(setTariffs).catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="bill-page bill-page--fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: '#ffffff' }} />
      </div>
    );
  }

  if (!server) {
    return (
      <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 32 }}>
        <h3 style={{ color: '#fff' }}>Сервер не найден</h3>
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard/servers')} style={{ marginTop: 20 }}>Назад</button>
      </div>
    );
  }

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  };

  const expires = new Date(server.expiresAt);
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000));
  const isAdmin = user?.role === 'admin' || user?.isAdmin;

  const handleRenew = async (months: number) => {
    setActionLoading('renew');
    try {
      const result = await serversApi.renew(server.id, months);
      setServer(result.server);
      await refreshUser();
      showMsg(`Сервер продлён на ${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить сервер безвозвратно?')) return;
    setActionLoading('delete');
    try {
      if (server.pterodactylServerId) {
        try {
          await pteroApi.deleteServer(server.pterodactylServerId);
        } catch (e: any) {
          console.warn('[Pterodactyl] Ошибка удаления, но удаляем локально:', e.message);
        }
      }
      await serversApi.delete(server.id);
      navigate('/dashboard/servers');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
      setActionLoading('');
    }
  };

  const handleAutoRenewToggle = async () => {
    const newState = !autoRenew;
    setActionLoading('autorenew');
    try {
      const updated = await serversApi.update(server.id, { autoRenew: newState });
      setServer(updated);
      setAutoRenew(newState);
      showMsg(`Автопродление ${newState ? 'включено' : 'отключено'}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleChangeTariff = async (newTariff: Tariff) => {
    setActionLoading('changeTariff');
    setShowConfirmChange(null);
    try {
      const result = await serversApi.changeTariff(server.id, newTariff.id);
      setServer(result.server);
      await refreshUser();
      showMsg(`Тариф изменён на ${newTariff.tier} ${newTariff.name}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const loadPteroCredentials = async () => {
    setCredsLoading(true);
    try {
      const token = localStorage.getItem('lmx_token');
      const res = await fetch('/api/auth/ptero-credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Нет данных');
      const data = await res.json();
      setPteroLogin(data.login);
      setPteroPassword(data.password || 'Пароль не задан');
    } catch (e) {
      showMsg('Не удалось получить данные для входа в Pterodactyl', 'error');
    } finally {
      setCredsLoading(false);
    }
  };

  const statusColor = server.status === 'active' ? '#34d399' : server.status === 'suspended' ? '#fbbf24' : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bill-page bill-page--fill"
    >
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 16px',
              borderRadius: 16,
              marginBottom: 20,
              background: msgType === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
              border: `1px solid ${msgType === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`,
              color: msgType === 'error' ? '#f87171' : '#34d399',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span><i className={`fas ${msgType === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}`} style={{ marginRight: 8 }} />{msg}</span>
            <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><i className="fas fa-times" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bill-page__head">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, marginBottom: 4, color: '#fff' }}>{server.name}</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${statusColor}20`, color: statusColor }}>
              {server.status === 'active' ? 'Активен' : server.status === 'suspended' ? 'Заблокирован' : 'Истёк'}
            </div>
            {server.tariffTier === 'Free' && (
              <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>Free</div>
            )}
            <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              <i className="fas fa-calendar-alt" style={{ marginRight: 6 }} /> Истекает: {expires.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        {/* Кнопка "Панель управления" – для VDS ведёт на vm.austocloud.fun, для game/coding – на Pterodactyl */}
        {(server.type === 'vps' || server.pterodactylIdentifier) && (
          <a
            href={
              server.type === 'vps'
                ? 'https://vm.austocloud.fun'
                : `${PTERO_URL}/server/${server.pterodactylIdentifier}`
            }
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: isMobile ? '8px 16px' : '10px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              color: '#fff',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 500,
              fontSize: isMobile ? 13 : 14,
            }}
          >
            <i className="fas fa-external-link-alt" /> {isMobile ? 'Панель' : 'Панель управления'}
          </a>
        )}
      </div>

      <motion.div className="bill-manage-tabs">
        {[
          { id: 'overview', label: 'Обзор', icon: 'fa-info-circle' },
          { id: 'resources', label: 'Ресурсы', icon: 'fa-chart-bar' },
          { id: 'renewal', label: 'Продление', icon: 'fa-calendar-plus' },
          { id: 'changeTariff', label: 'Смена тарифа', icon: 'fa-arrow-up' },
          { id: 'danger', label: 'Опасная зона', icon: 'fa-exclamation-triangle' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`bill-manage-tab${activeTab === tab.id ? ' bill-manage-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <i className={`fas ${tab.icon}`} /> {isMobile ? '' : tab.label}
          </button>
        ))}
      </motion.div>
      </div>

      <motion.div className="bill-page__body">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          className="bill-manage-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="bill-manage-panel__grid" style={isMobile ? { gridTemplateColumns: '1fr' } : undefined}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 28, padding: isMobile ? 20 : 28 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fas fa-tag" style={{ color: '#ffffff' }} /> Информация
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div><span style={{ color: 'var(--text-dim)' }}>Тариф:</span> <strong>{server.tariffTier} {server.tariffName}</strong></div>

                  {/* Отображение ОС для VDS вместо Ядра */}
                  {server.type === 'vps' ? (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>ОС:</span>{' '}
                      <strong>
                        {(() => {
                          const t = server.os_template || '';
                          const parts = t.split('/');
                          const name = parts[parts.length - 1] || t;
                          return name
                            .replace(/\.tar\.(gz|xz|zst)$/, '')
                            .replace(/^vztmpl\//, '')
                            .replace(/-standard_/, ' ')
                            + ' (LXC)';
                        })()}
                      </strong>
                    </div>
                  ) : (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Ядро:</span>{' '}
                      <strong>{server.coreName || 'Не указано'}</strong>
                    </div>
                  )}

                  {server.ip && (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>IP:</span>{' '}
                      <strong style={{ fontFamily: 'monospace' }}>
                        {server.ip}{server.port != null ? ':' + server.port : ''}
                      </strong>
                    </div>
                  )}
                  <div><span style={{ color: 'var(--text-dim)' }}>Создан:</span> <strong>{new Date(server.createdAt).toLocaleDateString('ru-RU')}</strong></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Цена:</span> <strong>{formatPrice(server.price)}/мес</strong></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Автопродление:</span> <strong style={{ color: autoRenew ? '#34d399' : '#ef4444' }}>{autoRenew ? 'Включено' : 'Выключено'}</strong></div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={handleAutoRenewToggle}
                  disabled={actionLoading === 'autorenew'}
                  style={{ marginTop: 24, width: '100%', padding: '12px', borderRadius: 16 }}
                >
                  {actionLoading === 'autorenew' ? <i className="fas fa-spinner fa-spin" /> : (autoRenew ? 'Отключить автопродление' : 'Включить автопродление')}
                </button>

                {/* Показать логин/пароль Pterodactyl (только для game/coding) */}
                {(server.type === 'game' || server.type === 'coding') && (
                  <div style={{ marginTop: 24 }}>
                    {!showPteroCreds ? (
                      <button
                        className="btn btn-ghost"
                        onClick={async () => {
                          await loadPteroCredentials();
                          setShowPteroCreds(true);
                        }}
                        disabled={credsLoading}
                        style={{ width: '100%', padding: '12px', borderRadius: 16 }}
                      >
                        {credsLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-key" />}
                        {' '}Показать логин и пароль от панели Pterodactyl
                      </button>
                    ) : (
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        padding: 16,
                        marginTop: 12,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: '#fff' }}>Данные для входа</span>
                          <button
                            onClick={() => setShowPteroCreds(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                          ><i className="fas fa-times" /></button>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Логин (email): </span>
                          <code style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 8 }}>{pteroLogin}</code>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Пароль: </span>
                          <code style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 8 }}>{pteroPassword}</code>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 28, padding: isMobile ? 20 : 28 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fas fa-chart-line" style={{ color: '#ffffff' }} /> Статистика
                </h3>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, fontWeight: 800, color: daysLeft <= 7 ? '#ef4444' : '#ffffff' }}>{daysLeft}</div>
                  <div style={{ color: 'var(--text-dim)' }}>дней до истечения</div>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginTop: 16 }}>
                  <div style={{ width: `${Math.min(100, (daysLeft / 30) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #ffffff, #a3a3a3)', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'resources' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 28, padding: isMobile ? 20 : 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Выделенные ресурсы</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 24 }}>
                <div style={{ textAlign: 'center', padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 20 }}>
                  <i className="fas fa-microchip" style={{ fontSize: 32, color: '#ffffff', marginBottom: 12 }} />
                  <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>CPU</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{server.cores}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>ядер</div>
                </div>
                <div style={{ textAlign: 'center', padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 20 }}>
                  <i className="fas fa-memory" style={{ fontSize: 32, color: '#ffffff', marginBottom: 12 }} />
                  <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>RAM</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{(server.ram / 1024).toFixed(1)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>ГБ</div>
                </div>
                <div style={{ textAlign: 'center', padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 20, gridColumn: isMobile ? 'span 2' : undefined }}>
                  <i className="fas fa-hdd" style={{ fontSize: 32, color: '#ffffff', marginBottom: 12 }} />
                  <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>Диск</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{(server.disk / 1024).toFixed(1)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>ГБ</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'renewal' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 28, padding: isMobile ? 20 : 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Продлить сервер</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
                {[1, 3, 6, 12].map(m => {
                  const discount = getRenewalDiscountRate(m);
                  const displayPrice = calcRenewalCost(server.price, m);
                  return (
                    <button
                      key={m}
                      onClick={() => setRenewMonths(m)}
                      style={{
                        padding: isMobile ? '16px 4px' : '20px 8px',
                        borderRadius: 20,
                        border: `2px solid ${renewMonths === m ? '#ffffff' : 'rgba(255,255,255,0.1)'}`,
                        background: renewMonths === m ? 'rgba(59,130,246,0.1)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        position: 'relative',
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#fff' }}>{m} мес.</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>{formatPrice(displayPrice)}</div>
                      {discount > 0 && (
                        <span style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>-{discount * 100}%</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Итого к оплате:</span>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', marginLeft: 12 }}>{formatPrice(calcRenewalCost(server.price, renewMonths))}</span>
                </div>
                <button
                  className="btn btn-fill"
                  onClick={() => handleRenew(renewMonths)}
                  disabled={actionLoading === 'renew'}
                  style={{ padding: '14px 40px', background: '#ffffff', color: '#000', borderRadius: 16, fontWeight: 600, border: 'none' }}
                >
                  {actionLoading === 'renew' ? <i className="fas fa-spinner fa-spin" /> : 'Продлить →'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'changeTariff' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 28, padding: isMobile ? 20 : 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#fff' }}>Сменить тариф</h3>
              <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>Выберите более мощную конфигурацию</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20 }}>
                {tariffs.filter(t => {
                  if (t.id === server.tariffId) return false;
                  if (server.type === 'vps') return t.type === 'vps';
                  if (server.type === 'coding') return t.type === 'coding';
                  return t.type === 'game';
                }).map(t => (
                  <div
                    key={t.id}
                    onClick={() => setShowConfirmChange(t)}
                    style={{
                      padding: 20,
                      borderRadius: 20,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#ffffff'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#fff' }}>{t.tier} {t.name}</div>
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div><span style={{ color: 'var(--text-dim)' }}>CPU:</span> {t.cores} ядер</div>
                      <div><span style={{ color: 'var(--text-dim)' }}>RAM:</span> {(t.ram / 1024).toFixed(1)} ГБ</div>
                      <div><span style={{ color: 'var(--text-dim)' }}>Диск:</span> {(t.disk / 1024).toFixed(1)} ГБ</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>{formatPrice(t.price)}<span style={{ fontSize: 14 }}>/мес</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 28, padding: 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-exclamation-triangle" /> Удаление сервера
              </h3>
              <p style={{ color: 'var(--text-gray)', marginBottom: 24 }}>
                Это действие необратимо. Все данные сервера будут удалены без возможности восстановления.
              </p>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={actionLoading === 'delete'}
                style={{
                  background: 'rgba(239,68,68,0.2)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444',
                  padding: '12px 24px',
                  borderRadius: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {actionLoading === 'delete' ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-trash" />} Удалить сервер навсегда
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showConfirmChange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setShowConfirmChange(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{ background: '#0f1117', borderRadius: 28, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#fff' }}>Подтверждение</h3>
              <p style={{ marginBottom: 24, color: 'var(--text-gray)', lineHeight: 1.6 }}>
                Вы уверены, что хотите сменить тариф на <strong>{showConfirmChange.tier} {showConfirmChange.name}</strong>?
                {server.pterodactylServerId && <><br />Ресурсы сервера в Pterodactyl будут обновлены.</>}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setShowConfirmChange(null)} style={{ padding: '10px 20px' }}>Отмена</button>
                <button
                  className="btn btn-fill"
                  onClick={() => handleChangeTariff(showConfirmChange)}
                  disabled={actionLoading === 'changeTariff'}
                  style={{ background: '#ffffff', color: '#000', padding: '10px 20px', borderRadius: 16, border: 'none' }}
                >
                  {actionLoading === 'changeTariff' ? <i className="fas fa-spinner fa-spin" /> : 'Сменить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}