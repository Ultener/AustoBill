import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Logo, { APP_NAME } from '../components/Logo';

interface NodeStatus {
  id: number;
  name: string;
  description: string | null;
  location_id: number | null;
  public: boolean;
  maintenance_mode: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  servers_count?: number;
  created_at: string;
  updated_at: string;
  status: 'active' | 'maintenance';
}

interface StatusData {
  site: { online: boolean; message: string };
  panel: { online: boolean; message: string };
  nodes: NodeStatus[];
  timestamp: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getLocationName(nodeId: number, _locationId: number | null) {
  if (nodeId === 1) return 'Германия 1';
  if (nodeId === 2) return 'Германия 2';
  return 'Германия';
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: online ? '#fff' : '#525252',
        boxShadow: online ? '0 0 12px rgba(255,255,255,0.5)' : 'none',
        flexShrink: 0,
      }}
    />
  );
}

export default function Status() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
      setLastUpdate(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const pageShell = (
    <div className="site-page-with-sticky-nav" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-white)' }}>
      <header
        className="site-sticky-header"
        style={{
          borderBottom: '1px solid var(--border-dim)',
          background: 'rgba(5,5,5,0.92)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          className="ac-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <Logo to="/" size={34} />
          <Link to="/" className="ac-btn ac-btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
            <i className="fas fa-arrow-left" style={{ marginRight: 8 }} />
            На главную
          </Link>
        </div>
      </header>

      <main className="ac-container" style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '32px 20px 48px' : '48px 24px 64px' }}>
        {loading ? (
          <motion.div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.i
              className="fas fa-spinner fa-spin"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ fontSize: 36, color: 'var(--text-gray)' }}
            />
          </motion.div>
        ) : error || !data ? (
          <motion.div className="ac-card" style={{ padding: 48, textAlign: 'center' }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: 40, color: 'var(--text-gray)', marginBottom: 16 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Не удалось загрузить статус</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>{error || 'Неизвестная ошибка'}</p>
            <button type="button" className="ac-btn ac-btn-primary" onClick={() => { setLoading(true); fetchStatus(); }}>
              Повторить
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ marginBottom: 40 }}>
              <div className="ac-label">Мониторинг · {APP_NAME}</div>
              <h1 className="ac-title" style={{ marginBottom: 12 }}>Статус нод и сервисов</h1>
              <p className="ac-subtitle" style={{ margin: 0 }}>
                Актуальное состояние сайта, панели и игровых узлов. Обновление каждые 30 секунд.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginTop: 20,
                  alignItems: 'center',
                  fontSize: 13,
                  color: 'var(--text-dim)',
                }}
              >
                <span>
                  <i className="fas fa-clock" style={{ marginRight: 6 }} />
                  API: {data.timestamp ? new Date(data.timestamp).toLocaleString('ru-RU') : '—'}
                </span>
                <span>
                  <i className="fas fa-sync" style={{ marginRight: 6 }} />
                  Локально: {lastUpdate}
                </span>
                <button
                  type="button"
                  className="ac-btn ac-btn-ghost"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  onClick={() => fetchStatus()}
                >
                  Обновить сейчас
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 16,
                marginBottom: 40,
              }}
            >
              {[
                { title: 'Сайт', sub: APP_NAME, status: data.site, icon: 'fa-globe' },
                { title: 'Панель', sub: 'Pterodactyl', status: data.panel, icon: 'fa-server' },
              ].map(item => (
                <motion.div
                  key={item.title}
                  className="ac-card"
                  whileHover={{ borderColor: 'var(--border-light)' }}
                  style={{ padding: 24, display: 'flex', gap: 20, alignItems: 'center' }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      color: item.status.online ? '#fff' : 'var(--text-dim)',
                      background: item.status.online ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <i className={`fas ${item.icon}`} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <motion.div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{item.sub}</motion.div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{item.title}</h3>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: item.status.online ? '#fff' : 'var(--text-dim)' }}>
                      <StatusDot online={item.status.online} />
                      {item.status.message}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Игровые ноды</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 6 }}>Локация: Германия</p>
              </div>
              <span
                style={{
                  fontSize: 12,
                  padding: '6px 14px',
                  borderRadius: 100,
                  border: '1px solid var(--border-dim)',
                  color: 'var(--text-gray)',
                }}
              >
                Всего нод: {data.nodes.length}
              </span>
            </div>

            <AnimatePresence mode="wait">
              {data.nodes.length === 0 ? (
                <motion.div className="ac-card" style={{ padding: 48, textAlign: 'center' }}>
                  <i className="fas fa-database" style={{ fontSize: 40, color: 'var(--text-dim)', marginBottom: 16 }} />
                  <p style={{ color: 'var(--text-gray)' }}>Ноды не найдены или панель недоступна.</p>
                </motion.div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 16,
                  }}
                >
                  {data.nodes.map((node, i) => {
                    const isActive = node.status === 'active';
                    const locationName = getLocationName(node.id, node.location_id);
                    const memoryBytes = node.memory * 1024 * 1024;
                    const diskBytes = node.disk * 1024 * 1024;

                    return (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="ac-card"
                        style={{ padding: 22, position: 'relative', overflow: 'hidden' }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 120,
                            height: 120,
                            background: 'radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 70%)',
                            pointerEvents: 'none',
                          }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.08em' }}>
                              NODE #{node.id}
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <i className="fas fa-microchip" style={{ fontSize: 14, color: 'var(--text-gray)' }} />
                              {node.name}
                            </h3>
                          </div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 100,
                              fontSize: 11,
                              fontWeight: 600,
                              border: '1px solid',
                              borderColor: isActive ? 'var(--border-light)' : 'var(--border-dim)',
                              color: isActive ? '#fff' : 'var(--text-dim)',
                              background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <StatusDot online={isActive} />
                            {isActive ? 'Активна' : 'Техработы'}
                          </span>
                        </div>

                        {node.description && (
                          <p style={{ fontSize: 13, color: 'var(--text-gray)', marginBottom: 16, lineHeight: 1.5 }}>
                            {node.description}
                          </p>
                        )}

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                            padding: 16,
                            borderRadius: 12,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-dim)',
                            marginBottom: 16,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                              Локация
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <i className="fas fa-location-dot" style={{ fontSize: 11, color: 'var(--text-dim)' }} />
                              {locationName}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                              Обновлена
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              {new Date(node.updated_at).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-dim)' }}>
                              <i className="fas fa-memory" style={{ marginRight: 6 }} />
                              RAM
                            </span>
                            <span style={{ fontWeight: 600 }}>{formatBytes(memoryBytes)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-dim)' }}>
                              <i className="fas fa-hdd" style={{ marginRight: 6 }} />
                              Диск
                            </span>
                            <span style={{ fontWeight: 600 }}>{formatBytes(diskBytes)}</span>
                          </div>
                          {node.servers_count !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <span style={{ color: 'var(--text-dim)' }}>
                                <i className="fas fa-cube" style={{ marginRight: 6 }} />
                                Серверов
                              </span>
                              <span style={{ fontWeight: 600 }}>{node.servers_count}</span>
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            paddingTop: 12,
                            borderTop: '1px solid var(--border-dim)',
                            fontSize: 11,
                            color: 'var(--text-dim)',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>Публичная: {node.public ? 'да' : 'нет'}</span>
                          <span>Создана: {new Date(node.created_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>

            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Link to="/dashboard/purchase" className="ac-btn ac-btn-primary" style={{ marginRight: 12 }}>
                Заказать сервер
              </Link>
              <Link to="/" className="ac-btn ac-btn-ghost">
                Тарифы на главной
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );

  return pageShell;
}
