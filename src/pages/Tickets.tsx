import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { Ticket, ticketsApi, serversApi, GameServer, adminApi } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketMessageCard } from '../components/TicketMessageCard';
import { appendTicketImages, cleanTicketMessageText } from '../utils/ticketMessage';
import { PageHeader } from '../components/billing/DashboardUI';
import {
  BillFormShell,
  BillField,
  BillInput,
  BillTextarea,
  BillSelect,
  BillFormGrid,
  BillFormActions,
  BillAttachBtn,
} from '../components/billing/BillForm';

const DEPARTMENTS = [
  { id: 'tech', name: 'Технический' },
  { id: 'purchase', name: 'Приобрести' },
  { id: 'billing', name: 'Биллинг' },
  { id: 'general', name: 'Общий вопрос' },
];

const TICKET_REASONS = [
  { id: 'server', name: 'Проблема с сервером' },
  { id: 'billing', name: 'Оплата и баланс' },
  { id: 'technical', name: 'Техническая проблема' },
  { id: 'other', name: 'Другое' },
];

const PRIORITIES = [
  { id: 'low', name: 'Низкий приоритет', color: '#34d399' },
  { id: 'medium', name: 'Средний приоритет', color: '#fbbf24' },
  { id: 'high', name: 'Высокий приоритет', color: '#ef4444' },
];

const SERVICE_TYPES = [
  { id: 'game', name: 'Игровые сервера' },
  { id: 'coding', name: 'Кодинг сервера' },
  { id: 'vps', name: 'VDS / VPS' },
  { id: 'none', name: 'Услуга не выбрана' },
];

async function uploadTicketImages(previews: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const dataUrl of previews) {
    const { url } = await ticketsApi.uploadImage(dataUrl);
    urls.push(url);
  }
  return urls;
}

export default function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [view, setView] = useState<'list' | 'detail' | 'new'>('list');
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0].id);
  const [reason, setReason] = useState(TICKET_REASONS[0].id);
  const [priority, setPriority] = useState(PRIORITIES[0].id);
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0].id);
  const [selectedServer, setSelectedServer] = useState<GameServer | null>(null);

  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [imgPreviews, setImgPreviews] = useState<string[]>([]);
  const [replyImgPreviews, setReplyImgPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);

  const [deletingAll, setDeletingAll] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.isAdmin;

  // Адаптивность
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadTickets();
    loadServers();
  }, []);

  useEffect(() => {
    if (!activeTicket || activeTicket.userId !== user?.id) return;
    ticketsApi.markRead(activeTicket.id).catch(() => {});
  }, [activeTicket?.id, user?.id]);

  const loadTickets = () => ticketsApi.list().then(setTickets).catch(() => {});
  const loadServers = () => serversApi.list().then(setServers).catch(() => {});

  const readImageFiles = (
    files: FileList,
    onDone: (previews: string[]) => void,
  ) => {
    const valid = Array.from(files).filter(f => f.size <= 5 * 1024 * 1024);
    if (!valid.length) return;
    const previews: string[] = [];
    let loaded = 0;
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) previews.push(ev.target.result as string);
        loaded += 1;
        if (loaded === valid.length) onDone(previews);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    readImageFiles(files, added => setImgPreviews(prev => [...prev, ...added]));
    e.target.value = '';
  };

  const handleReplyImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    readImageFiles(files, added => setReplyImgPreviews(prev => [...prev, ...added]));
    e.target.value = '';
  };

  const removeImage = (idx: number) => setImgPreviews(prev => prev.filter((_, i) => i !== idx));
  const removeReplyImage = (idx: number) => setReplyImgPreviews(prev => prev.filter((_, i) => i !== idx));

  const handleCreate = async () => {
    setError('');
    if (!subject.trim()) { setError('Введите тему'); return; }
    if (!message.trim() && imgPreviews.length === 0) { setError('Введите сообщение или прикрепите скриншот'); return; }

    try {
      setUploading(true);
      let fullMessage = `[Приоритет: ${PRIORITIES.find(p => p.id === priority)?.name}]\n`;
      fullMessage += `[Причина: ${TICKET_REASONS.find(r => r.id === reason)?.name}]\n`;
      fullMessage += `[Тип услуги: ${SERVICE_TYPES.find(s => s.id === serviceType)?.name}]\n`;
      if (selectedServer) fullMessage += `[Сервер: ${selectedServer.name} (${selectedServer.id})]\n`;
      fullMessage += `\n${message}`;

      if (imgPreviews.length > 0) {
        const urls = await uploadTicketImages(imgPreviews);
        fullMessage = appendTicketImages(fullMessage, urls);
      }

      await ticketsApi.create(subject, DEPARTMENTS.find(d => d.id === department)!.name, fullMessage);
      setSubject('');
      setMessage('');
      setDepartment(DEPARTMENTS[0].id);
      setReason(TICKET_REASONS[0].id);
      setPriority(PRIORITIES[0].id);
      setServiceType(SERVICE_TYPES[0].id);
      setSelectedServer(null);
      setImgPreviews([]);
      loadTickets();
      setView('list');
    } catch (e) {
      if (e instanceof Error && e.message.includes('через')) setError(e.message);
      else setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setUploading(false);
    }
  };

  const handleReply = async () => {
    if (!activeTicket || (!reply.trim() && replyImgPreviews.length === 0)) return;
    try {
      setUploading(true);
      let content = reply.trim();
      if (replyImgPreviews.length > 0) {
        const urls = await uploadTicketImages(replyImgPreviews);
        content = appendTicketImages(content, urls);
      }
      const updated = await ticketsApi.reply(activeTicket.id, content);
      setActiveTicket(updated);
      setReply('');
      setReplyImgPreviews([]);
      loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = async () => {
    if (!activeTicket) return;
    try {
      await ticketsApi.close(activeTicket.id);
      loadTickets();
      setView('list');
      setActiveTicket(null);
    } catch { /* ignore */ }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот тикет? Это действие нельзя отменить.')) return;
    try {
      await adminApi.deleteTicket(ticketId);
      loadTickets();
      if (activeTicket?.id === ticketId) {
        setView('list');
        setActiveTicket(null);
      }
    } catch (e) {
      alert('Ошибка при удалении тикета');
    }
  };

  const handleDeleteAllTickets = async () => {
    if (!confirm('ВНИМАНИЕ! Вы собираетесь удалить ВСЕ тикеты. Это действие необратимо. Продолжить?')) return;
    setDeletingAll(true);
    try {
      await adminApi.deleteAllTickets();
      setTickets([]);
      setView('list');
      setActiveTicket(null);
    } catch (e) {
      alert('Ошибка при удалении всех тикетов');
    } finally {
      setDeletingAll(false);
    }
  };

  const statusInfo = (s: string) => ({
    open: { label: 'Открыт', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
    answered: { label: 'Отвечен', color: '#ffffff', bg: 'rgba(59,130,246,0.15)' },
    closed: { label: 'Закрыт', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  }[s] || { label: s, color: '#6b7280', bg: 'rgba(107,114,128,0.15)' });

  const getDepartmentInfo = (_deptName: string) => {
    return { icon: 'fa-headset', color: '#6b7280' };
  };

  const extractPriority = (ticket: Ticket) => {
    const firstMsg = ticket.messages[0]?.content || '';
    if (firstMsg.includes('[Приоритет: Низкий приоритет]')) return 'Низкий';
    if (firstMsg.includes('[Приоритет: Средний приоритет]')) return 'Средний';
    if (firstMsg.includes('[Приоритет: Высокий приоритет]')) return 'Высокий';
    return 'Не указан';
  };

  const extractServiceType = (ticket: Ticket) => {
    const firstMsg = ticket.messages[0]?.content || '';
    if (firstMsg.includes('[Тип услуги: Игровые сервера]')) return 'Игровые сервера';
    return 'Не указана';
  };

  const lastMessage = activeTicket?.messages[activeTicket.messages.length - 1];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : '0 20px' }}
    >
      {/* Шапка и кнопки */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="dash-title" style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, marginBottom: 4, color: '#fff' }}>Тикеты</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0, color: 'var(--text-dim)' }}>Обратитесь в поддержку</p>
        </div>
        {view === 'list' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', width: isMobile ? '100%' : 'auto' }}>
            {isAdmin && (
              <button
                onClick={handleDeleteAllTickets}
                disabled={deletingAll}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444',
                  padding: '10px 20px',
                  borderRadius: 40,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: '0.2s',
                  flex: isMobile ? 1 : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              >
                {deletingAll ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-trash-alt" />} {isMobile ? 'Удалить все' : 'Удалить все'}
              </button>
            )}
            <button
              type="button"
              className="ac-btn ac-btn-primary"
              onClick={() => setView('new')}
              style={{
                padding: '10px 24px',
                flex: isMobile ? 1 : 'none',
              }}
            >
              <i className="fas fa-plus" /> Новый тикет
            </button>
          </div>
        )}
        {view !== 'list' && (
          <button
            onClick={() => { setView('list'); setActiveTicket(null); setImgPreviews([]); }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '10px 20px',
              borderRadius: 40,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i className="fas fa-arrow-left" /> Назад
          </button>
        )}
      </div>

      {/* Форма создания тикета */}
      <AnimatePresence mode="wait">
        {view === 'new' && (
          <motion.div key="new" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <BillFormShell
              title="Создать обращение"
              subtitle="Здесь вы можете создать новое обращение в службу поддержки. Опишите проблему подробнее — так мы быстрее поможем."
            >
              {error && (
                <div className="bill-alert bill-alert--error">
                  <i className="fas fa-exclamation-circle" /> {error}
                </div>
              )}

              <BillField label="Тема вашего обращения" required>
                <BillInput
                  icon="fa-tag"
                  placeholder="Коротко опишите проблему"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </BillField>

              <BillField label="Распишите подробнее" required>
                <BillTextarea
                  icon="fa-comment-dots"
                  placeholder="Подробно опишите ваш вопрос или проблему"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </BillField>

              <BillFormGrid cols={2}>
                <BillField label="Выберите департамент" required>
                  <BillSelect
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    options={DEPARTMENTS.map(d => ({ value: d.id, label: d.name }))}
                  />
                </BillField>
                <BillField label="Выберите причину" required>
                  <BillSelect
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    options={TICKET_REASONS.map(r => ({ value: r.id, label: r.name }))}
                  />
                </BillField>
              </BillFormGrid>

              <BillField label="Выберите приоритет" required>
                <BillSelect
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  options={PRIORITIES.map(p => ({ value: p.id, label: p.name }))}
                />
              </BillField>

              <BillFormGrid cols={2}>
                <BillField label="Тип связанной услуги">
                  <BillSelect
                    value={serviceType}
                    onChange={e => setServiceType(e.target.value)}
                    options={SERVICE_TYPES.map(s => ({ value: s.id, label: s.name }))}
                  />
                </BillField>
                <BillField label="Связанная услуга" required={serviceType !== 'none'}>
                  <BillSelect
                    value={selectedServer?.id || ''}
                    onChange={e => {
                      const serverId = e.target.value;
                      setSelectedServer(serverId ? servers.find(s => s.id === serverId) || null : null);
                    }}
                    options={[
                      { value: '', label: 'Услуга не выбрана' },
                      ...servers.map(s => ({
                        value: s.id,
                        label: `${s.name} (${s.tariffTier} ${s.tariffName})`,
                      })),
                    ]}
                  />
                </BillField>
              </BillFormGrid>

              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />

              {imgPreviews.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {imgPreviews.map((src, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'relative',
                        width: 72,
                        height: 72,
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: '1px solid var(--border-dim)',
                      }}
                    >
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.75)',
                          border: '1px solid var(--border-light)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                        aria-label="Удалить изображение"
                      >
                        <i className="fas fa-times" style={{ fontSize: 9 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <BillFormActions attach={<BillAttachBtn onClick={() => fileRef.current?.click()} title="Прикрепить скриншот" />}>
                <button
                  type="button"
                  className="ac-btn ac-btn-primary"
                  style={{ width: '100%', padding: '14px 24px', fontSize: 15 }}
                  onClick={handleCreate}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><i className="fas fa-spinner fa-spin" /> Загрузка…</>
                  ) : (
                    <><i className="fas fa-plus" /> Создать обращение</>
                  )}
                </button>
              </BillFormActions>

              <p className="bill-field__hint" style={{ textAlign: 'center' }}>
                <i className="fas fa-clock" style={{ marginRight: 6 }} />
                Не чаще одного тикета в 15 минут
              </p>
            </BillFormShell>
          </motion.div>
        )}

        {/* Список тикетов */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {tickets.length === 0 ? (
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 32,
                  textAlign: 'center',
                  padding: '60px 28px',
                }}
              >
                <i className="fas fa-ticket" style={{ fontSize: 48, opacity: 0.3, marginBottom: 16, color: '#fff' }} />
                <h3 style={{ marginBottom: 8, color: '#fff' }}>Тикетов пока нет</h3>
                <p style={{ color: 'var(--text-dim)', marginBottom: 20 }}>Создайте тикет, если вам нужна помощь</p>
                <button
                  onClick={() => setView('new')}
                  style={{
                    background: '#ffffff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: 12,
                    fontWeight: 600,
                    color: '#0a0a0a',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fas fa-plus" /> Создать тикет
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 24,
                }}
              >
                {tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(t => {
                  const st = statusInfo(t.status);
                  const deptInfo = getDepartmentInfo(t.category);
                  return (
                    <motion.div
                      key={t.id}
                      whileHover={{ y: -6 }}
                      onClick={() => { setActiveTicket(t); setView('detail'); }}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 28,
                        padding: 24,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i className={`fas ${deptInfo.icon}`} style={{ color: '#ffffff', fontSize: 14 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.category}</span>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '4px 12px',
                            borderRadius: 30,
                            background: st.bg,
                            color: st.color,
                          }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#fff', lineHeight: 1.3 }}>{t.subject}</h3>
                      {t.messages[0] && (
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {cleanTicketMessageText(t.messages[0].content) || '—'}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-dim)' }}>
                          <span><i className="fas fa-calendar-alt" style={{ marginRight: 4 }} /> {new Date(t.createdAt).toLocaleDateString('ru-RU')}</span>
                          <span><i className="fas fa-comments" style={{ marginRight: 4 }} /> {t.messages.length}</span>
                        </div>
                        <i className="fas fa-arrow-right" style={{ fontSize: 12, color: '#ffffff' }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Детальный просмотр тикета */}
        {view === 'detail' && activeTicket && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 24 }}>
              {/* Левая колонка — чат */}
              <div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 32,
                    padding: 24,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#fff' }}>{activeTicket.subject}</h3>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-dim)' }}>
                        <span><i className="fas fa-folder" style={{ marginRight: 4 }} /> {activeTicket.category}</span>
                        <span><i className="fas fa-calendar" style={{ marginRight: 4 }} /> {new Date(activeTicket.createdAt).toLocaleString('ru-RU')}</span>
                        <span><i className="fas fa-comments" style={{ marginRight: 4 }} /> {activeTicket.messages.length} сообщ.</span>
                        <span style={{ padding: '2px 10px', borderRadius: 30, background: statusInfo(activeTicket.status).bg, color: statusInfo(activeTicket.status).color }}>
                          {statusInfo(activeTicket.status).label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {activeTicket.status !== 'closed' && (
                        <button
                          onClick={handleClose}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 30,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <i className="fas fa-times" /> Закрыть
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTicket(activeTicket.id)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 30,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <i className="fas fa-trash" /> Удалить
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 32,
                    padding: 24,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
                    {activeTicket.messages.map(m => (
                      <TicketMessageCard key={m.id} message={m} />
                    ))}
                  </div>
                  {activeTicket.status !== 'closed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <textarea
                        className="form-input"
                        rows={3}
                        placeholder="Ваш ответ..."
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#0a0a0f',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 20,
                          padding: '12px 16px',
                          color: '#fff',
                          resize: 'vertical',
                          minHeight: 80,
                        }}
                      />
                      <div>
                        <input ref={replyFileRef} type="file" accept="image/*" multiple onChange={handleReplyImageSelect} style={{ display: 'none' }} />
                        <button
                          type="button"
                          className="ac-btn ac-btn-ghost"
                          onClick={() => replyFileRef.current?.click()}
                          style={{ fontSize: 13 }}
                        >
                          <i className="fas fa-image" style={{ marginRight: 6 }} /> Прикрепить скриншот
                        </button>
                        {replyImgPreviews.length > 0 && (
                          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                            {replyImgPreviews.map((src, i) => (
                              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                  type="button"
                                  onClick={() => removeReplyImage(i)}
                                  style={{
                                    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                                    background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10,
                                  }}
                                >
                                  <i className="fas fa-times" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleReply}
                        disabled={uploading}
                        style={{
                          padding: '12px 24px',
                          borderRadius: 30,
                          background: '#ffffff',
                          border: 'none',
                          color: '#000',
                          fontWeight: 600,
                          cursor: uploading ? 'wait' : 'pointer',
                          alignSelf: isMobile ? 'stretch' : 'flex-start',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: uploading ? 0.7 : 1,
                          height: 48,
                        }}
                      >
                        {uploading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Правая колонка — информация */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 32,
                  padding: 24,
                  height: 'fit-content',
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#fff' }}>Детали обращения</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>№ обращения</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#fff' }}>#{activeTicket.id.substring(0, 8)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Создан</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{new Date(activeTicket.createdAt).toLocaleString('ru-RU')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Последнее сообщение</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{lastMessage ? new Date(lastMessage.createdAt).toLocaleString('ru-RU') : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Департамент</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{activeTicket.category}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Приоритет</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{extractPriority(activeTicket)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Email</div>
                    <div style={{ fontWeight: 600, wordBreak: 'break-all', color: '#fff' }}>{user?.email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Услуга</div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{extractServiceType(activeTicket)}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}