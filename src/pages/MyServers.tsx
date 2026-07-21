import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { GameServer, serversApi } from '../store';
import { motion } from 'framer-motion';

export default function MyServers() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<GameServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeTab, setActiveTypeTab] = useState<'vps' | 'game'>('game'); // ← первыми открываются «Игровые / Кодинг»
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    serversApi.list()
      .then(setServers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Фильтрация по выбранному типу
  const filteredServers = servers.filter(s => {
    if (activeTypeTab === 'vps') return s.type === 'vps';
    return s.type !== 'vps';
  });

  // Статистика по отфильтрованным серверам
  const activeCount = filteredServers.filter(s => s.status === 'active').length;
  const suspendedCount = filteredServers.filter(s => s.status === 'suspended').length;
  const expiredCount = filteredServers.filter(s => s.status === 'expired').length;

  const statusLabel = (status: string) => {
    if (status === 'active') return { text: 'Активен', color: '#34d399', bg: 'rgba(52,211,153,0.15)' };
    if (status === 'suspended') return { text: 'Заблокирован', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };
    return { text: 'Истёк', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (loading) {
    return (
      <div className="bill-page bill-page--fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="bill-loading">
          <i className="fas fa-circle-notch fa-spin" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bill-page bill-page--fill"
    >
      <motion.div variants={itemVariants} className="bill-page__head">
      <motion.div
        variants={itemVariants}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <h1 className="dash-title" style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, marginBottom: 4, color: '#fff' }}>Мои серверы</h1>
          <p className="dash-subtitle" style={{ color: 'var(--text-dim)', marginBottom: 0 }}>Управляйте своими серверами</p>
        </div>
        <button
          type="button"
          className="ac-btn ac-btn-primary"
          onClick={() => navigate('/dashboard/purchase')}
          style={{
            padding: isMobile ? '10px 16px' : '12px 24px',
            fontSize: isMobile ? 14 : 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          <i className="fas fa-plus" /> Новый сервер
        </button>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bill-tabs"
        style={{ marginBottom: 20, maxWidth: isMobile ? '100%' : 480 }}
      >
        <button
          type="button"
          className={`bill-tab${activeTypeTab === 'game' ? ' bill-tab--active' : ''}`}
          onClick={() => setActiveTypeTab('game')}
        >
          <i className="fas fa-gamepad" /> {isMobile ? 'Игры' : 'Игровые'}
        </button>
        <button
          type="button"
          className={`bill-tab${activeTypeTab === 'vps' ? ' bill-tab--active' : ''}`}
          onClick={() => setActiveTypeTab('vps')}
        >
          <i className="fas fa-cloud" /> VDS
        </button>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bill-stat-grid"
        style={{ marginBottom: 0 }}
      >
        {[
          { label: 'Активные', value: activeCount, icon: 'fa-check-circle', color: '#34d399' },
          { label: 'Заблокированные', value: suspendedCount, icon: 'fa-ban', color: '#fbbf24' },
          { label: 'Истекшие', value: expiredCount, icon: 'fa-hourglass-end', color: '#6b7280' }
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 24,
              padding: isMobile ? '16px' : '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              borderRadius: 18,
              background: `${stat.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 20 : 24,
              color: stat.color
            }}>
              <i className={`fas ${stat.icon}`} />
            </div>
            <div>
              <div style={{
                fontSize: isMobile ? 11 : 13,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 4
              }}>
                {stat.label}
              </div>
              <div style={{
                fontSize: isMobile ? 24 : 32,
                fontWeight: 700,
                lineHeight: 1.2,
                color: '#fff'
              }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </motion.div>
      </motion.div>

      <motion.div variants={itemVariants} className="bill-page__body">
      {filteredServers.length === 0 ? (
        <motion.div variants={itemVariants} className="ac-card bill-empty-fill">
          <i className="fas fa-server" style={{ fontSize: 48, opacity: 0.3, marginBottom: 16, color: '#fff' }} />
          <h3 style={{ marginBottom: 8, color: '#fff' }}>
            {activeTypeTab === 'vps' ? 'Нет VDS серверов' : 'Нет игровых серверов'}
          </h3>
          <p style={{ color: 'var(--text-dim)', marginBottom: 20 }}>Создайте новый сервер</p>
          <button
            type="button"
            className="ac-btn ac-btn-primary"
            onClick={() => navigate('/dashboard/purchase')}
            style={{ padding: '12px 24px' }}
          >
            <i className="fas fa-rocket" /> Создать сервер
          </button>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="bill-servers-grid">
          {filteredServers.map((server) => {
            const status = statusLabel(server.status);
            const daysLeft = Math.max(0, Math.ceil((new Date(server.expiresAt).getTime() - Date.now()) / 86400000));
            const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;

            return (
              <motion.div
                key={server.id}
                whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300 } }}
                onClick={() => navigate(`/dashboard/server/${server.id}`)}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 28,
                  padding: 24,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Декоративный градиентный блик */}
                <div style={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 150,
                  height: 150,
                  background: `radial-gradient(circle, ${status.color}20, transparent 70%)`,
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{server.name}</h3>
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: status.bg,
                    color: status.color
                  }}>
                    {status.text}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 16,
                  marginBottom: 20
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Тариф</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{server.tariffTier} {server.tariffName}</div>
                  </div>

                  {/* Блок: ОС или Ядро */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                      {server.type === 'vps' ? 'ОС' : 'Ядро'}
                    </div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>
                      {server.type === 'vps' ? (
                        (() => {
                          const t = server.os_template || '';
                          const parts = t.split('/');
                          const name = parts[parts.length - 1] || t;
                          return name
                            .replace(/\.tar\.(gz|xz|zst)$/, '')
                            .replace(/^vztmpl\//, '')
                            .replace(/-standard_/, ' ')
                            + ' (LXC)';
                        })()
                      ) : (
                        server.coreName || '—'
                      )}
                    </div>
                  </div>

                  {/* IP – для VDS без порта, для остальных с портом */}
                  {server.ip && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>IP</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#fff' }}>
                        {server.type === 'vps'
                          ? server.ip
                          : `${server.ip}:${server.port}`
                        }
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>RAM</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{server.ram >= 1024 ? (server.ram / 1024).toFixed(0) + ' ГБ' : server.ram + ' МБ'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Осталось</div>
                    <div style={{ fontWeight: 600, color: isExpiringSoon ? '#ef4444' : status.color }}>{daysLeft} дней</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Цена</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{server.price}₽/мес</div>
                  </div>
                </div>

                <div style={{
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    <i className="fas fa-arrow-right" /> Подробнее
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
      </motion.div>
    </motion.div>
  );
}