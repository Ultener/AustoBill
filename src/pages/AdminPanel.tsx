import { useState, useEffect, useCallback, useMemo } from 'react';
import { GameServer, User, Ticket, Tariff, serversApi, adminApi, ticketsApi, plansApi, pteroApi, reviewsApi, Review } from '../store';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminPromoTab, AdminReferralsTab } from './admin/AdminPromoReferrals';
import { AdminLayout, type AdminHubCard } from '../components/admin/AdminLayout';
import { AdminPagination } from '../components/admin/AdminPagination';
import { TicketMessageCard } from '../components/TicketMessageCard';
import { usePagination } from '../hooks/usePagination';
import { validatePlanNameClient, validatePlanSpecsClient } from '../utils/security';

type Tab = 'servers' | 'users' | 'tickets' | 'plans' | 'ptero' | 'reviews' | 'mailing' | 'promos' | 'referrals';

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: 30,
      fontSize: 12,
      fontWeight: 600,
      backgroundColor: color + '20',
      color: color,
      backdropFilter: 'blur(4px)',
    }}
  >
    {children}
  </span>
);

const ActionButton = ({ onClick, disabled, loading, icon, children, variant = 'default' }: any) => {
  const variantStyles = {
    default: { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' },
    success: { background: 'rgba(52,211,153,0.15)', borderColor: 'rgba(52,211,153,0.3)', color: '#34d399' },
    warn: { background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' },
    danger: { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' },
  };
  const style = variantStyles[variant] || variantStyles.default;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '6px 14px',
        borderRadius: 24,
        border: '1px solid',
        ...style,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        backdropFilter: 'blur(4px)',
      }}
    >
      {loading ? <i className="fas fa-spinner fa-spin" /> : icon && <i className={`fas ${icon}`} style={{ fontSize: 11 }} />}
      {children}
    </motion.button>
  );
};

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || !!currentUser?.isAdmin;
  const isSupportOnly = currentUser?.role === 'support' && !isAdmin;
  const [section, setSection] = useState<Tab | null>(isSupportOnly ? 'tickets' : null);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [plans, setPlans] = useState<Tariff[]>([]);
  const [reviews, setReviews] = useState<(Review & { email: string })[]>([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [euUsername, setEuUsername] = useState('');
  const [euEmail, setEuEmail] = useState('');
  const [euPassword, setEuPassword] = useState('');
  const [euBalance, setEuBalance] = useState('');
  const [euRole, setEuRole] = useState<'user' | 'admin' | 'support'>('user');
  const [euBlocked, setEuBlocked] = useState(false);
  const [euBanReason, setEuBanReason] = useState('');
  const [euBanByIp, setEuBanByIp] = useState(false);
  const [extendServer, setExtendServer] = useState<GameServer | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [editPlan, setEditPlan] = useState<Tariff | null>(null);
  const [newPlan, setNewPlan] = useState(false);
  const [pName, setPName] = useState('');
  const [pTier, setPTier] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pRam, setPRam] = useState('');
  const [pCores, setPCores] = useState('');
  const [pDisk, setPDisk] = useState('');
  const [pFeatures, setPFeatures] = useState('');
  const [pIcon, setPIcon] = useState('fa-cube');
  const [pDesc, setPDesc] = useState('');
  const [pPopular, setPPopular] = useState(false);
  const [pType, setPType] = useState<'game' | 'coding' | 'vps'>('game');
  const [pOncePerAccount, setPOncePerAccount] = useState(false);
  const [pNodeId, setPNodeId] = useState<number | null>(null);
  const [nodesList, setNodesList] = useState<{ id: number; name: string }[]>([]);
  const [pteroData, setPteroData] = useState<{ servers: unknown[]; users: unknown[] } | null>(null);
  const [pteroLoading, setPteroLoading] = useState(false);
  const [pteroError, setPteroError] = useState('');
  const [pteroConnected, setPteroConnected] = useState<boolean | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [editServer, setEditServer] = useState<GameServer | null>(null);
  const [esName, setEsName] = useState('');
  const [esTariffId, setEsTariffId] = useState('');
  const [esRam, setEsRam] = useState('');
  const [esCores, setEsCores] = useState('');
  const [esDisk, setEsDisk] = useState('');
  const [esPrice, setEsPrice] = useState('');
  const [esExtendDays, setEsExtendDays] = useState('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Состояния для рассылки
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailRecipient, setMailRecipient] = useState<'all' | 'user'>('all');
  const [mailSelectedUserId, setMailSelectedUserId] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [mailUserSearch, setMailUserSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'game' | 'coding' | 'vps'>('all');

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  };

  const reload = useCallback(() => {
    ticketsApi.list().then(setTickets).catch(() => {});
    if (isSupportOnly) return;
    serversApi.list().then(setServers).catch(() => {});
    adminApi.users().then(setUsers).catch(() => {});
    plansApi.list().then(setPlans).catch(() => {});
    reviewsApi.adminList().then(setReviews).catch(() => {});
  }, [isSupportOnly]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (isSupportOnly && section && section !== 'tickets') {
      setSection('tickets');
    }
  }, [isSupportOnly, section]);

  const loadPtero = useCallback(async () => {
    setPteroLoading(true);
    setPteroError('');
    try {
      const [s, u] = await Promise.all([pteroApi.servers(), pteroApi.users()]);
      setPteroData({ servers: (s as { data?: unknown[] }).data || [], users: (u as { data?: unknown[] }).data || [] });
      setPteroConnected(true);
    } catch (e) {
      setPteroError(e instanceof Error ? e.message : 'Ошибка');
      setPteroConnected(false);
    } finally {
      setPteroLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'ptero') loadPtero();
  }, [section, loadPtero]);

  // Загрузка списка нод для выбора в тарифах
  useEffect(() => {
    fetch('/api/nodes', {
      headers: { Authorization: `Bearer ${localStorage.getItem('lmx_token')}` }
    })
      .then(res => res.json())
      .then(data => setNodesList(data))
      .catch(console.error);
  }, []);

  const testPtero = async () => {
    setTestLoading(true);
    try {
      const r = await pteroApi.test();
      if (r.success) {
        showMsg(`Подключено! Серверов: ${r.total_servers}`);
        setPteroConnected(true);
      } else {
        showMsg(r.error || 'Ошибка', 'error');
        setPteroConnected(false);
      }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setTestLoading(false);
    }
  };

  const toggleSuspend = async (s: GameServer) => {
    setActionLoading(s.id);
    try {
      if (s.pterodactylServerId) {
        if (s.status !== 'suspended') await pteroApi.suspend(s.pterodactylServerId);
        else await pteroApi.unsuspend(s.pterodactylServerId);
      }
      await adminApi.updateServer(s.id, { status: s.status === 'suspended' ? 'active' : 'suspended' });
      reload();
      showMsg(`"${s.name}" ${s.status === 'suspended' ? 'разблокирован' : 'заблокирован'}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const doExtend = async () => {
    if (!extendServer) return;
    try {
      const exp = new Date(Math.max(new Date(extendServer.expiresAt).getTime(), Date.now()));
      exp.setMonth(exp.getMonth() + extendMonths);
      await adminApi.updateServer(extendServer.id, { expiresAt: exp.toISOString(), status: 'active' });
      reload();
      showMsg(`"${extendServer.name}" продлён на ${extendMonths} мес.`);
      setExtendServer(null);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    }
  };

  const removeServer = async (s: GameServer) => {
    if (!confirm(`Удалить "${s.name}"?`)) return;
    setActionLoading(s.id);
    try {
      if (s.pterodactylServerId) await pteroApi.deleteServer(s.pterodactylServerId).catch(() => {});
      await adminApi.deleteServer(s.id);
      reload();
      showMsg(`"${s.name}" удалён`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const openEditUser = (u: User) => {
    setEditUser(u);
    setEuUsername(u.username);
    setEuEmail(u.email);
    setEuPassword('');
    setEuBalance(u.balance.toString());
    setEuRole(u.role || 'user');
    setEuBlocked(u.blocked);
    setEuBanReason(u.banReason || '');
    setEuBanByIp(!!u.banByIp);
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    if (euBlocked && euBanReason.trim().length < 3) {
      showMsg('Укажите причину блокировки (минимум 3 символа)', 'error');
      return;
    }
    try {
      const result = await adminApi.updateUser(editUser.id, {
        username: euUsername,
        email: euEmail,
        password: euPassword || undefined,
        balance: parseFloat(euBalance),
        role: euRole,
        blocked: euBlocked,
        banReason: euBlocked ? euBanReason.trim() : undefined,
        banByIp: euBlocked && isAdmin ? euBanByIp : undefined,
      }) as User & { banWarning?: string };
      reload();
      if (result.banWarning) showMsg(result.banWarning, 'error');
      else showMsg(`"${euUsername}" обновлён`);
      setEditUser(null);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    }
  };

  const removeUser = async (u: User) => {
    if (!confirm(`Удалить "${u.username}"?`)) return;
    try {
      await adminApi.deleteUser(u.id);
      reload();
      showMsg(`Удалён: ${u.username}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    }
  };

  const handleTicketReply = async () => {
    if (!activeTicket || !ticketReply.trim() || !currentUser) return;
    try {
      const updated = await ticketsApi.reply(activeTicket.id, ticketReply);
      setActiveTicket(updated);
      setTicketReply('');
      reload();
    } catch {
      /* ignore */
    }
  };

  const handleTicketClose = async (t: Ticket) => {
    try {
      await ticketsApi.close(t.id);
      reload();
      if (activeTicket?.id === t.id) setActiveTicket(null);
      showMsg('Тикет закрыт');
    } catch {
      /* ignore */
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm('Удалить этот тикет? Сообщения также будут удалены.')) return;
    setActionLoading(`ticket-${ticketId}`);
    try {
      await adminApi.deleteTicket(ticketId);
      reload();
      showMsg('Тикет удалён');
      if (activeTicket?.id === ticketId) setActiveTicket(null);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const deleteAllTickets = async () => {
    if (!confirm('Вы уверены, что хотите удалить ВСЕ тикеты? Это действие необратимо.')) return;
    setActionLoading('delete-all');
    try {
      await adminApi.deleteAllTickets();
      reload();
      setActiveTicket(null);
      showMsg('Все тикеты удалены');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
      setShowDeleteAllModal(false);
    }
  };

  const approveReview = async (id: string) => {
    setActionLoading(`review-approve-${id}`);
    try {
      await reviewsApi.adminApprove(id);
      setReviews(prev => prev.map(r => (r.id === id ? { ...r, status: 'approved' as const } : r)));
      showMsg('Отзыв одобрен и опубликован');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const rejectReview = async (id: string) => {
    if (!confirm('Отклонить этот отзыв? Он не будет показан на сайте.')) return;
    setActionLoading(`review-reject-${id}`);
    try {
      await reviewsApi.adminReject(id);
      setReviews(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected' as const } : r)));
      showMsg('Отзыв отклонён');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Удалить этот отзыв?')) return;
    setActionLoading(`review-${id}`);
    try {
      await reviewsApi.adminDelete(id);
      setReviews(prev => prev.filter(r => r.id !== id));
      showMsg('Отзыв удалён');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const pendingReviewsCount = reviews.filter(r => r.status === 'pending').length;

  const openEditPlan = (p: Tariff) => {
    setEditPlan(p);
    setPName(p.name);
    setPTier(p.tier);
    setPPrice(p.price.toString());
    setPRam(p.ram.toString());
    setPCores(p.cores.toString());
    setPDisk(p.disk.toString());
    setPFeatures(p.features.join('\n'));
    setPIcon(p.icon);
    setPDesc(p.description);
    setPPopular(p.popular);
    setPType(p.type || 'game');
    setPOncePerAccount(!!p.once_per_account);
    setPNodeId(p.node_id !== undefined && p.node_id !== null ? p.node_id : null);
    setNewPlan(false);
  };

  const openNewPlan = () => {
    setEditPlan(null);
    setPName('');
    setPTier('');
    setPPrice('');
    setPRam('');
    setPCores('');
    setPDisk('');
    setPFeatures('');
    setPIcon('fa-cube');
    setPDesc('');
    setPPopular(false);
    setPType(planTypeFilter === 'all' ? 'game' : planTypeFilter);
    setPOncePerAccount(false);
    setPNodeId(null);
    setNewPlan(true);
  };

  const savePlan = async () => {
    const nameErr = validatePlanNameClient(pName, 'Название');
    const tierErr = validatePlanNameClient(pTier, 'Уровень');
    const specsErr = validatePlanSpecsClient(pRam, pCores, pDisk, pPrice);
    if (nameErr || tierErr || specsErr) {
      showMsg(nameErr || tierErr || specsErr || 'Ошибка валидации', 'error');
      return;
    }
    const data = {
      name: pName.trim(),
      tier: pTier.trim(),
      price: parseFloat(pPrice),
      ram: parseInt(pRam, 10),
      cores: parseInt(pCores, 10),
      disk: parseInt(pDisk, 10),
      features: pFeatures.split('\n').filter(Boolean),
      icon: pIcon,
      description: pDesc,
      popular: pPopular,
      type: pType,
      once_per_account: pOncePerAccount,
      node_id: pNodeId,
    };
    try {
      if (editPlan) {
        await plansApi.update(editPlan.id, data);
        showMsg('Тариф обновлён');
      } else {
        await plansApi.create(data);
        showMsg('Тариф создан');
      }
      reload();
      setEditPlan(null);
      setNewPlan(false);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    }
  };

  const removePlan = async (id: string) => {
    if (!confirm('Удалить тариф?')) return;
    try {
      await plansApi.delete(id);
      reload();
      showMsg('Тариф удалён');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    }
  };

  const pteroSuspendS = async (sid: number) => {
    setActionLoading(`p${sid}`);
    try {
      await pteroApi.suspend(sid);
      showMsg(`#${sid} приостановлен`);
      loadPtero();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const pteroUnsuspendS = async (sid: number) => {
    setActionLoading(`p${sid}`);
    try {
      await pteroApi.unsuspend(sid);
      showMsg(`#${sid} возобновлён`);
      loadPtero();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const pteroDeleteS = async (sid: number) => {
    if (!confirm(`Удалить #${sid}?`)) return;
    setActionLoading(`p${sid}`);
    try {
      await pteroApi.deleteServer(sid);
      showMsg(`#${sid} удалён`);
      loadPtero();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const openEditServer = (s: GameServer) => {
    setEditServer(s);
    setEsName(s.name);
    setEsTariffId(s.tariffId || '');
    setEsRam(s.ram.toString());
    setEsCores(s.cores.toString());
    setEsDisk(s.disk.toString());
    setEsPrice(s.price.toString());
    setEsExtendDays('');
  };

  const handleTariffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tariffId = e.target.value;
    setEsTariffId(tariffId);
    const tariff = plans.find(p => p.id === tariffId);
    if (tariff) {
      setEsRam(tariff.ram.toString());
      setEsCores(tariff.cores.toString());
      setEsDisk(tariff.disk.toString());
      setEsPrice(tariff.price.toString());
    }
  };

  const saveEditServer = async () => {
    if (!editServer) return;
    const data: any = {
      name: esName,
      ram: parseInt(esRam),
      cores: parseInt(esCores),
      disk: parseInt(esDisk),
      price: parseFloat(esPrice),
    };
    if (esTariffId) {
      data.tariffId = esTariffId;
      const tariff = plans.find(p => p.id === esTariffId);
      if (tariff) {
        data.tariffName = tariff.name;
        data.tariffTier = tariff.tier;
      }
    }
    if (esExtendDays) {
      const days = parseInt(esExtendDays);
      if (days > 0) {
        const newExpires = new Date(editServer.expiresAt);
        newExpires.setDate(newExpires.getDate() + days);
        data.expiresAt = newExpires.toISOString();
      }
    }
    try {
      await adminApi.updateServer(editServer.id, data);
      reload();
      setEditServer(null);
      showMsg('Сервер обновлён');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Ошибка', 'error');
    }
  };

  const sendMailing = async () => {
    if (!mailSubject.trim() || !mailBody.trim()) {
      showMsg('Заполните тему и текст письма', 'error');
      return;
    }
    if (mailRecipient === 'user' && !mailSelectedUserId) {
      showMsg('Выберите пользователя', 'error');
      return;
    }
    setMailSending(true);
    try {
      const payload: any = {
        subject: mailSubject,
        html: mailBody.replace(/\n/g, '<br>'),
      };
      if (mailRecipient === 'all') {
        payload.to = 'all';
      } else {
        payload.userId = mailSelectedUserId;
      }
      const response = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('lmx_token')}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      showMsg(data.message, 'success');
      setMailSubject('');
      setMailBody('');
      setMailSelectedUserId('');
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Ошибка отправки', 'error');
    } finally {
      setMailSending(false);
    }
  };

  const mailingUserOptions = users.filter(u =>
    u.username.toLowerCase().includes(mailUserSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(mailUserSearch.toLowerCase())
  );

  const statusBadge = (s: string) => {
    if (s === 'active') return <Badge color="#34d399">Активен</Badge>;
    if (s === 'suspended') return <Badge color="#fbbf24">Заблокирован</Badge>;
    return <Badge color="#6b7280">Истёк</Badge>;
  };

  const roleBadge = (r: string) => {
    const config = {
      admin: { color: '#ef4444', label: 'Админ' },
      support: { color: '#fbbf24', label: 'Саппорт' },
      user: { color: '#ffffff', label: 'Юзер' },
    };
    const c = config[r] || config.user;
    return <Badge color={c.color}>{c.label}</Badge>;
  };

  const openTickets = tickets.filter(t => t.status !== 'closed').length;

  const allAdminHubCards: AdminHubCard<Tab>[] = [
    { id: 'servers', label: 'Серверы', description: 'Аренда, блокировка, продление', icon: 'fa-server', group: 'Операции', count: servers.length },
    { id: 'users', label: 'Пользователи', description: 'Аккаунты, балансы, роли', icon: 'fa-users', group: 'Операции', count: users.length },
    { id: 'tickets', label: 'Тикеты', description: 'Поддержка и ответы', icon: 'fa-life-ring', group: 'Операции', count: openTickets },
    { id: 'plans', label: 'Тарифы', description: 'Планы и лимиты', icon: 'fa-layer-group', group: 'Каталог', count: plans.length },
    { id: 'reviews', label: 'Отзывы', description: 'Модерация отзывов', icon: 'fa-star', group: 'Каталог', count: pendingReviewsCount || reviews.length },
    { id: 'ptero', label: 'Pterodactyl', description: 'Игровые серверы в панели', icon: 'fa-dragon', group: 'Интеграции' },
    { id: 'promos', label: 'Промокоды', description: 'Скидки и бонусы', icon: 'fa-percent', group: 'Маркетинг' },
    { id: 'referrals', label: 'Рефералы', description: 'Реферальная статистика', icon: 'fa-user-plus', group: 'Маркетинг' },
    { id: 'mailing', label: 'Рассылка', description: 'Email клиентам', icon: 'fa-envelope', group: 'Маркетинг' },
  ];

  const adminHubCards = isSupportOnly
    ? allAdminHubCards.filter(c => c.id === 'tickets')
    : allAdminHubCards;

  const paginateReset = [section];
  const sortedTickets = useMemo(() => {
    const order: Record<string, number> = { open: 0, answered: 1, closed: 2 };
    return [...tickets].sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0));
  }, [tickets]);

  const filteredServers = useMemo(() => {
    const q = serverSearch.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(s => s.name.toLowerCase().includes(q));
  }, [servers, serverSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const filteredPlans = useMemo(() => {
    if (planTypeFilter === 'all') return plans;
    return plans.filter(p => p.type === planTypeFilter);
  }, [plans, planTypeFilter]);

  const serversPag = usePagination(filteredServers, 6, [section, serverSearch]);
  const usersPag = usePagination(filteredUsers, 6, [section, userSearch]);
  const ticketsPag = usePagination(sortedTickets, 6, paginateReset);
  const plansPag = usePagination(filteredPlans, 6, [section, planTypeFilter]);
  const reviewsPag = usePagination(reviews, 6, paginateReset);
  const pteroServersList = (pteroData?.servers as unknown[]) || [];
  const pteroServersPag = usePagination(pteroServersList, 6, paginateReset);

  const adminTabMeta: Record<Tab, { title: string; description: string }> = {
    servers: { title: 'Серверы', description: 'Управление арендованными серверами клиентов' },
    users: { title: 'Пользователи', description: 'Аккаунты, балансы и роли' },
    tickets: { title: 'Тикеты', description: 'Обращения в поддержку' },
    plans: { title: 'Тарифы', description: 'Тарифные планы и лимиты' },
    ptero: { title: 'Pterodactyl', description: 'Синхронизация с панелью игровых серверов' },
    reviews: { title: 'Отзывы', description: 'Модерация отзывов пользователей' },
    mailing: { title: 'Рассылка', description: 'Email-уведомления клиентам' },
    promos: { title: 'Промокоды', description: 'Скидки и бонусы на пополнение' },
    referrals: { title: 'Рефералы', description: 'Реферальная программа и регистрации' },
  };

  const planModal = (editPlan || newPlan) && (
    <div
      className="modal-overlay"
      onClick={() => {
        setEditPlan(null);
        setNewPlan(false);
      }}
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
    >
      <motion.div
        className="modal-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f1117',
          borderRadius: 32,
          padding: 32,
          maxWidth: 700,
          width: '90%',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#fff',
          }}
        >
          <i className="fas fa-tag" style={{ color: '#ffffff' }} />{' '}
          {editPlan ? 'Редактирование тарифа' : 'Новый тариф'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Название</label>
            <input
              className="form-input"
              value={pName}
              onChange={e => setPName(e.target.value)}
              placeholder="Lite"
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Уровень (tier)</label>
            <input
              className="form-input"
              value={pTier}
              onChange={e => setPTier(e.target.value)}
              placeholder="Кролик"
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Цена (₽/мес)</label>
            <input
              className="form-input"
              type="number"
              value={pPrice}
              onChange={e => setPPrice(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Иконка (FA класс)</label>
            <input
              className="form-input"
              value={pIcon}
              onChange={e => setPIcon(e.target.value)}
              placeholder="fa-cube"
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>RAM (МБ)</label>
            <input
              className="form-input"
              type="number"
              value={pRam}
              onChange={e => setPRam(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>CPU (ядра)</label>
            <input
              className="form-input"
              type="number"
              value={pCores}
              onChange={e => setPCores(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Диск (МБ)</label>
            <input
              className="form-input"
              type="number"
              value={pDisk}
              onChange={e => setPDisk(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-gray)' }}>
              <input type="checkbox" checked={pPopular} onChange={e => setPPopular(e.target.checked)} /> Популярный
            </label>
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Тип тарифа</label>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="planType" value="game" checked={pType === 'game'} onChange={() => setPType('game')} />
                <span>🎮 Игровые серверы</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="planType" value="coding" checked={pType === 'coding'} onChange={() => setPType('coding')} />
                <span>💻 Кодинг серверы (Node.js, Python, Go)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="planType" value="vps" checked={pType === 'vps'} onChange={() => setPType('vps')} />
                <span>☁️ VDS серверы (LXC)</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-gray)' }}>
              <input type="checkbox" checked={pOncePerAccount} onChange={e => setPOncePerAccount(e.target.checked)} />
              Ограничить: один раз на аккаунт
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              При включении пользователь сможет приобрести этот тариф только один раз.
            </p>
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-gray)' }}>Привязка к ноде (Pterodactyl)</label>
            <select
              className="form-input"
              value={pNodeId === null ? '' : pNodeId}
              onChange={e => setPNodeId(e.target.value === '' ? null : parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                color: '#fff',
              }}
            >
              <option value="">— Любая нода —</option>
              {nodesList.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} (ID: {node.id})
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              Если выбран конкретный узел, сервер с этим тарифом можно будет создать только на нём (только для Pterodactyl).
            </p>
          </div>
        </div>
        <div className="form-group">
          <label style={{ color: 'var(--text-gray)' }}>Описание</label>
          <input
            className="form-input"
            value={pDesc}
            onChange={e => setPDesc(e.target.value)}
            placeholder="Для небольших серверов"
            style={{
              width: '100%',
              padding: '12px',
              background: '#0a0a0f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              color: '#fff',
            }}
          />
        </div>
        <div className="form-group">
          <label style={{ color: 'var(--text-gray)' }}>Характеристики (по строке)</label>
          <textarea
            className="form-input"
            rows={4}
            value={pFeatures}
            onChange={e => setPFeatures(e.target.value)}
            placeholder="3 ГБ RAM&#10;1 ядро&#10;25 ГБ SSD"
            style={{
              width: '100%',
              padding: '12px',
              background: '#0a0a0f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              color: '#fff',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setEditPlan(null);
              setNewPlan(false);
            }}
            style={{
              padding: '10px 20px',
              borderRadius: 30,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            className="btn btn-fill"
            onClick={savePlan}
            style={{
              padding: '10px 20px',
              borderRadius: 30,
              background: '#ffffff',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-save" /> Сохранить
          </button>
        </div>
      </motion.div>
    </div>
  );

  const adminMeta = section ? adminTabMeta[section] : null;

  return (
    <>
      <AdminLayout
        section={section}
        onSectionChange={id => {
          if (isSupportOnly && id !== 'tickets') return;
          setSection(id);
          setActiveTicket(null);
        }}
        cards={adminHubCards}
        sectionTitle={isSupportOnly ? 'Тикеты поддержки' : adminMeta?.title}
        sectionDescription={isSupportOnly ? 'Ответы клиентам и управление обращениями' : adminMeta?.description}
        msg={section ? msg : undefined}
        msgType={msgType}
        onDismissMsg={() => setMsg('')}
        onRefresh={section ? reload : undefined}
        backLabel={isSupportOnly ? 'К списку тикетов' : 'К разделам'}
        onBack={() => {
          setActiveTicket(null);
          setServerSearch('');
          setUserSearch('');
          setPlanTypeFilter('all');
          if (isSupportOnly) setSection('tickets');
          else setSection(null);
        }}
      >
          {section === 'servers' && (
            <>
            <div className="admin-toolbar">
              <label className="admin-search">
                <i className="fas fa-search admin-search__icon" aria-hidden />
                <input
                  type="search"
                  className="admin-search__input"
                  placeholder="Поиск по названию сервера…"
                  value={serverSearch}
                  onChange={e => setServerSearch(e.target.value)}
                  aria-label="Поиск серверов по названию"
                />
                {serverSearch ? (
                  <button
                    type="button"
                    className="admin-search__clear"
                    onClick={() => setServerSearch('')}
                    aria-label="Очистить поиск"
                  >
                    <i className="fas fa-times" />
                  </button>
                ) : null}
              </label>
              <span className="admin-toolbar__hint">
                {filteredServers.length === servers.length
                  ? `Всего: ${servers.length}`
                  : `Найдено: ${filteredServers.length} из ${servers.length}`}
              </span>
            </div>
            <div className="admin-table-wrap admin-table-wrap--cards">
              {filteredServers.length === 0 ? (
                <p className="admin-empty">{serverSearch.trim() ? 'Серверы не найдены' : 'Нет серверов'}</p>
              ) : (
                <table className="admin-table admin-table--stack">
                  <thead
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <tr>
                      <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Название</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Владелец</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Тариф</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Тип</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Статус</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serversPag.items.map(s => {
                      const owner = users.find(u => u.id === s.userId);
                      const ld = actionLoading === s.id;
                      return (
                        <tr
                          key={s.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <td data-label="Название" className="admin-table__primary">{s.name}</td>
                          <td data-label="Владелец">{owner?.username || '—'}</td>
                          <td data-label="Тариф">{s.tariffTier} {s.tariffName}</td>
                          <td data-label="Тип">
                            {s.type === 'game' && <Badge color="#ffffff">Игровой</Badge>}
                            {s.type === 'coding' && <Badge color="#a3a3a3">Кодинг</Badge>}
                            {s.type === 'vps' && <Badge color="#10b981">VDS</Badge>}
                          </td>
                          <td data-label="Статус">{statusBadge(s.status)}</td>
                          <td data-label="Действия" className="admin-table__actions">
                            <ActionButton variant="default" onClick={() => openEditServer(s)} icon="fa-edit">Изменить</ActionButton>
                            <ActionButton variant="success" onClick={() => { setExtendServer(s); setExtendMonths(1); }} icon="fa-calendar-plus">Продлить</ActionButton>
                            <ActionButton variant="danger" onClick={() => removeServer(s)} disabled={ld} loading={ld} icon="fa-trash">Удалить</ActionButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <AdminPagination
                page={serversPag.page}
                totalPages={serversPag.totalPages}
                total={serversPag.total}
                pageSize={serversPag.pageSize}
                onPageChange={serversPag.setPage}
              />
            </div>
            </>
          )}

          {section === 'users' && (
            <>
            <div className="admin-toolbar">
              <label className="admin-search">
                <i className="fas fa-search admin-search__icon" aria-hidden />
                <input
                  type="search"
                  className="admin-search__input"
                  placeholder="Поиск по нику или почте…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  aria-label="Поиск пользователей по нику или email"
                />
                {userSearch ? (
                  <button
                    type="button"
                    className="admin-search__clear"
                    onClick={() => setUserSearch('')}
                    aria-label="Очистить поиск"
                  >
                    <i className="fas fa-times" />
                  </button>
                ) : null}
              </label>
              <span className="admin-toolbar__hint">
                {filteredUsers.length === users.length
                  ? `Всего: ${users.length}`
                  : `Найдено: ${filteredUsers.length} из ${users.length}`}
              </span>
            </div>
            <div className="admin-table-wrap admin-table-wrap--cards">
              {filteredUsers.length === 0 ? (
                <p className="admin-empty">{userSearch.trim() ? 'Пользователи не найдены' : 'Нет пользователей'}</p>
              ) : (
              <table className="admin-table admin-table--stack">
                <thead
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <tr>
                    <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Пользователь</th>
                    <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Почта</th>
                    <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Баланс</th>
                    <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Роль</th>
                    <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Статус</th>
                    <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {usersPag.items.map(u => (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <td data-label="Пользователь" className="admin-table__primary">{u.username}</td>
                      <td data-label="Почта">{u.email}</td>
                      <td data-label="Баланс">{u.balance.toLocaleString()}₽</td>
                      <td data-label="Роль">{roleBadge(u.role)}</td>
                      <td data-label="Статус">
                        {u.blocked ? <Badge color="#ef4444">Заблокирован</Badge> : <Badge color="#34d399">Активен</Badge>}
                      </td>
                      <td data-label="Действия" className="admin-table__actions">
                        <ActionButton variant="default" onClick={() => openEditUser(u)} icon="fa-edit">Изменить</ActionButton>
                        <ActionButton variant="danger" onClick={() => removeUser(u)} icon="fa-trash">Удалить</ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
              <AdminPagination
                page={usersPag.page}
                totalPages={usersPag.totalPages}
                total={usersPag.total}
                pageSize={usersPag.pageSize}
                onPageChange={usersPag.setPage}
              />
            </div>
            </>
          )}

          {section === 'tickets' && !activeTicket && (
            <div>
              <div className="admin-toolbar">
                <span className="admin-toolbar__hint">Всего тикетов: {tickets.length}</span>
                {isAdmin && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  disabled={actionLoading === 'delete-all'}
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444',
                    padding: '8px 20px',
                    borderRadius: 40,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: actionLoading === 'delete-all' ? 0.7 : 1,
                  }}
                >
                  {actionLoading === 'delete-all' ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Удаление...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-trash-alt" /> Удалить все тикеты
                    </>
                  )}
                </button>
                )}
              </div>
              <div className="admin-table-wrap admin-table-wrap--cards">
                {tickets.length === 0 ? (
                  <p className="admin-empty">Тикетов нет</p>
                ) : (
                  <table className="admin-table admin-table--stack">
                    <thead
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <tr>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Тема</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Пользователь</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Статус</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Дата</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketsPag.items.map(t => (
                          <tr
                            key={t.id}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <td data-label="Тема" className="admin-table__primary">{t.subject}</td>
                            <td data-label="Пользователь">{t.username}</td>
                            <td data-label="Статус">
                              <Badge
                                color={
                                  t.status === 'open' ? '#34d399' : t.status === 'answered' ? '#ffffff' : '#6b7280'
                                }
                              >
                                {t.status === 'open' ? 'Открыт' : t.status === 'answered' ? 'Отвечен' : 'Закрыт'}
                              </Badge>
                            </td>
                            <td data-label="Дата">
                              {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                            </td>
                            <td data-label="Действия" className="admin-table__actions">
                              <ActionButton variant="default" onClick={() => setActiveTicket(t)} icon="fa-eye">Открыть</ActionButton>
                              {isAdmin && (
                              <ActionButton
                                variant="danger"
                                onClick={() => deleteTicket(t.id)}
                                disabled={actionLoading === `ticket-${t.id}`}
                                loading={actionLoading === `ticket-${t.id}`}
                                icon="fa-trash"
                              >
                                Удалить
                              </ActionButton>
                              )}
                              {t.status !== 'closed' && (
                                <ActionButton variant="warn" onClick={() => handleTicketClose(t)} icon="fa-times">Закрыть</ActionButton>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
              <AdminPagination
                page={ticketsPag.page}
                totalPages={ticketsPag.totalPages}
                total={ticketsPag.total}
                pageSize={ticketsPag.pageSize}
                onPageChange={ticketsPag.setPage}
              />
            </div>
          )}

          {section === 'tickets' && activeTicket && (
            <div>
              <button type="button" className="admin-section__back" onClick={() => setActiveTicket(null)} style={{ marginBottom: 20 }}>
                <i className="fas fa-arrow-left" /> К списку тикетов
              </button>
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 32,
                  padding: 28,
                }}
              >
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
                  {activeTicket.subject}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                  {activeTicket.messages.map(m => (
                    <TicketMessageCard key={m.id} message={m} padding="20px" />
                  ))}
                </div>
                {activeTicket.status !== 'closed' && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Ваш ответ..."
                      value={ticketReply}
                      onChange={e => setTicketReply(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#0a0a0f',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 20,
                        padding: '12px 16px',
                        color: '#fff',
                      }}
                    />
                    <button
                      className="btn btn-fill"
                      onClick={handleTicketReply}
                      style={{
                        padding: '12px 28px',
                        borderRadius: 30,
                        background: '#ffffff',
                        border: 'none',
                        color: '#000',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fas fa-paper-plane" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'plans' && (
            <div>
              <div className="admin-toolbar admin-toolbar--plans">
                <div className="bill-tabs admin-plan-tabs">
                  <button
                    type="button"
                    className={`bill-tab${planTypeFilter === 'all' ? ' bill-tab--active' : ''}`}
                    onClick={() => setPlanTypeFilter('all')}
                  >
                    <i className="fas fa-layer-group" /> Все
                  </button>
                  <button
                    type="button"
                    className={`bill-tab${planTypeFilter === 'game' ? ' bill-tab--active' : ''}`}
                    onClick={() => setPlanTypeFilter('game')}
                  >
                    <i className="fas fa-gamepad" /> Игровые
                  </button>
                  <button
                    type="button"
                    className={`bill-tab${planTypeFilter === 'coding' ? ' bill-tab--active' : ''}`}
                    onClick={() => setPlanTypeFilter('coding')}
                  >
                    <i className="fas fa-code" /> Кодинг
                  </button>
                  <button
                    type="button"
                    className={`bill-tab${planTypeFilter === 'vps' ? ' bill-tab--active' : ''}`}
                    onClick={() => setPlanTypeFilter('vps')}
                  >
                    <i className="fas fa-cloud" /> VDS
                  </button>
                </div>
                <span className="admin-toolbar__hint">
                  {planTypeFilter === 'all'
                    ? `Всего: ${plans.length}`
                    : `${filteredPlans.length} из ${plans.length}`}
                </span>
                <button
                  type="button"
                  className="ac-btn ac-btn-primary"
                  onClick={openNewPlan}
                  style={{ flexShrink: 0 }}
                >
                  <i className="fas fa-plus" /> Новый тариф
                </button>
              </div>
              <div className="admin-table-wrap admin-table-wrap--cards">
                {filteredPlans.length === 0 ? (
                  <p className="admin-empty">
                    {plans.length === 0
                      ? 'Тарифов нет'
                      : planTypeFilter === 'game'
                        ? 'Нет игровых тарифов'
                        : planTypeFilter === 'coding'
                          ? 'Нет тарифов для кодинга'
                          : planTypeFilter === 'vps'
                            ? 'Нет VDS тарифов'
                            : 'Тарифов нет'}
                  </p>
                ) : (
                  <table className="admin-table admin-table--stack">
                    <thead
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <tr>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Название</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Уровень</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Цена</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>RAM</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>CPU</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Диск</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Тип</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Лимит</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Нода</th>
                        <th style={{ padding: '16px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plansPag.items.map(p => (
                        <tr
                          key={p.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <td data-label="Название" className="admin-table__primary">
                            {p.name}
                            {p.popular && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  background: '#ffffff',
                                  padding: '2px 8px',
                                  borderRadius: 20,
                                  fontSize: 10,
                                }}
                              >
                                ★
                              </span>
                            )}
                          </td>
                          <td data-label="Уровень">{p.tier}</td>
                          <td data-label="Цена">{p.price}₽</td>
                          <td data-label="RAM">
                            {p.ram >= 1024 ? (p.ram / 1024).toFixed(0) + ' ГБ' : p.ram + ' МБ'}
                          </td>
                          <td data-label="Ядра">{p.cores}</td>
                          <td data-label="Диск">
                            {p.disk >= 1024 ? (p.disk / 1024).toFixed(0) + ' ГБ' : p.disk + ' МБ'}
                          </td>
                          <td data-label="Тип">
                            {p.type === 'game' && <Badge color="#ffffff">Игровой</Badge>}
                            {p.type === 'coding' && <Badge color="#a3a3a3">Кодинг</Badge>}
                            {p.type === 'vps' && <Badge color="#10b981">VDS</Badge>}
                          </td>
                          <td data-label="Лимит">
                            {p.once_per_account ? (
                              <Badge color="#ef4444">Один раз</Badge>
                            ) : (
                              <Badge color="#6b7280">Неограничен</Badge>
                            )}
                          </td>
                          <td data-label="Нода">{p.node_id ? `Нода ${p.node_id}` : '—'}</td>
                          <td data-label="Действия" className="admin-table__actions">
                            <ActionButton variant="default" onClick={() => openEditPlan(p)} icon="fa-edit">Изменить</ActionButton>
                            <ActionButton variant="danger" onClick={() => removePlan(p.id)} icon="fa-trash">Удалить</ActionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <AdminPagination
                page={plansPag.page}
                totalPages={plansPag.totalPages}
                total={plansPag.total}
                pageSize={plansPag.pageSize}
                onPageChange={plansPag.setPage}
              />
            </div>
          )}

          {section === 'ptero' && (
            <div>
              <div className="ac-card admin-section-card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: pteroConnected ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    color: pteroConnected ? '#34d399' : '#ef4444',
                  }}
                >
                  <i className={`fas ${pteroConnected ? 'fa-check-circle' : 'fa-times-circle'}`} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    Pterodactyl — {pteroConnected ? 'Подключено' : 'Не подключено'}
                  </h3>
                </div>
                <ActionButton
                  variant="default"
                  onClick={testPtero}
                  disabled={testLoading}
                  loading={testLoading}
                  icon="fa-plug"
                >
                  {testLoading ? 'Проверка...' : 'Тест'}
                </ActionButton>
              </div>

              {pteroLoading && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 60,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 32,
                  }}
                >
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: '#ffffff' }} />
                </div>
              )}

              {pteroError && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.05)',
                    borderRadius: 32,
                    padding: 24,
                    marginBottom: 24,
                  }}
                >
                  <p style={{ color: '#ef4444', marginBottom: 12 }}>{pteroError}</p>
                  <ActionButton variant="default" onClick={loadPtero} icon="fa-redo">Повторить</ActionButton>
                </div>
              )}

              {pteroData && (
                <div className="ac-card admin-section-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <h3 style={{ padding: '20px 20px 0', fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Серверы ({pteroData.servers.length})
                  </h3>
                  <div className="admin-table-wrap admin-table-wrap--cards" style={{ marginTop: 12 }}>
                  {pteroData.servers.length === 0 ? (
                    <p style={{ padding: 24, color: 'var(--text-dim)' }}>Нет серверов в Pterodactyl</p>
                  ) : (
                    <table className="admin-table admin-table--stack">
                      <thead
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <tr>
                          <th style={{ padding: '16px 16px', textAlign: 'left' }}>ID</th>
                          <th style={{ padding: '16px 16px', textAlign: 'left' }}>Название</th>
                          <th style={{ padding: '16px 16px', textAlign: 'left' }}>User</th>
                          <th style={{ padding: '16px 16px', textAlign: 'left' }}>Статус</th>
                          <th style={{ padding: '16px 16px', textAlign: 'left' }}>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pteroServersPag.items.map((s: any) => {
                          const a = s.attributes;
                          const sid = a.id;
                          const susp = a.suspended;
                          const ld = actionLoading === `p${sid}`;
                          return (
                            <tr
                              key={sid}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <td data-label="ID" className="admin-table__primary">#{sid}</td>
                              <td data-label="Название">{a.name}</td>
                              <td data-label="User">#{a.user}</td>
                              <td data-label="Статус">
                                {susp ? <Badge color="#fbbf24">Suspended</Badge> : <Badge color="#34d399">Active</Badge>}
                              </td>
                              <td data-label="Действия" className="admin-table__actions">
                                {susp ? (
                                  <ActionButton
                                    variant="success"
                                    onClick={() => pteroUnsuspendS(sid)}
                                    disabled={ld}
                                    loading={ld}
                                    icon="fa-play"
                                  >
                                    Unsuspend
                                  </ActionButton>
                                ) : (
                                  <ActionButton
                                    variant="warn"
                                    onClick={() => pteroSuspendS(sid)}
                                    disabled={ld}
                                    loading={ld}
                                    icon="fa-pause"
                                  >
                                    Suspend
                                  </ActionButton>
                                )}
                                <ActionButton
                                  variant="danger"
                                  onClick={() => pteroDeleteS(sid)}
                                  disabled={ld}
                                  loading={ld}
                                  icon="fa-trash"
                                >
                                  Удалить
                                </ActionButton>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  </div>
                </div>
              )}
              <AdminPagination
                page={pteroServersPag.page}
                totalPages={pteroServersPag.totalPages}
                total={pteroServersPag.total}
                pageSize={pteroServersPag.pageSize}
                onPageChange={pteroServersPag.setPage}
              />
            </div>
          )}

          {section === 'reviews' && (
            <div className="admin-table-wrap admin-table-wrap--cards">
              {reviews.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)' }}>Отзывов пока нет</p>
              ) : (
                <table className="admin-table admin-table--stack">
                  <thead
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <tr>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Пользователь</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Статус</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Оценка</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Отзыв</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Дата</th>
                      <th style={{ padding: '16px 16px', textAlign: 'left' }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewsPag.items.map(r => (
                      <tr
                        key={r.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <td data-label="Пользователь" className="admin-table__primary">{r.userName}</td>
                        <td data-label="Email">{r.email}</td>
                        <td data-label="Статус">
                          <span
                            className={
                              'admin-badge ' +
                              (r.status === 'pending'
                                ? 'admin-badge--warn'
                                : r.status === 'approved'
                                  ? 'admin-badge--ok'
                                  : 'admin-badge--muted')
                            }
                          >
                            {r.status === 'pending'
                              ? 'На модерации'
                              : r.status === 'approved'
                                ? 'Опубликован'
                                : 'Отклонён'}
                          </span>
                        </td>
                        <td data-label="Оценка">
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map(i => (
                              <i
                                key={i}
                                className="fas fa-star"
                                style={{
                                  color: i <= r.rating ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                                  fontSize: 14,
                                }}
                              />
                            ))}
                          </div>
                        </td>
                        <td data-label="Отзыв" className="admin-table__text">
                          {r.text}
                        </td>
                        <td data-label="Дата">
                          {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td data-label="Действия" className="admin-table__actions">
                          {r.status === 'pending' && (
                            <>
                              <ActionButton
                                variant="success"
                                onClick={() => approveReview(r.id)}
                                disabled={!!actionLoading}
                                loading={actionLoading === `review-approve-${r.id}`}
                                icon="fa-check"
                              >
                                Одобрить
                              </ActionButton>
                              <ActionButton
                                variant="ghost"
                                onClick={() => rejectReview(r.id)}
                                disabled={!!actionLoading}
                                loading={actionLoading === `review-reject-${r.id}`}
                                icon="fa-times"
                              >
                                Отклонить
                              </ActionButton>
                            </>
                          )}
                          <ActionButton
                            variant="danger"
                            onClick={() => deleteReview(r.id)}
                            disabled={!!actionLoading}
                            loading={actionLoading === `review-${r.id}`}
                            icon="fa-trash"
                          >
                            Удалить
                          </ActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <AdminPagination
                page={reviewsPag.page}
                totalPages={reviewsPag.totalPages}
                total={reviewsPag.total}
                pageSize={reviewsPag.pageSize}
                onPageChange={reviewsPag.setPage}
              />
            </div>
          )}

          {section === 'mailing' && (
            <div className="ac-card admin-section-card">
              <h3>
                <i className="fas fa-envelope" style={{ marginRight: 10, opacity: 0.9 }} />
                Email рассылка
              </h3>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>Кому:</label>
                <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" name="recipient" value="all" checked={mailRecipient === 'all'} onChange={() => setMailRecipient('all')} />
                    Всем пользователям
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" name="recipient" value="user" checked={mailRecipient === 'user'} onChange={() => setMailRecipient('user')} />
                    Конкретному пользователю
                  </label>
                </div>
                {mailRecipient === 'user' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Поиск по имени или email..."
                      value={mailUserSearch}
                      onChange={e => setMailUserSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#0a0a0f',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#fff',
                        marginBottom: 12,
                      }}
                    />
                    <select
                      value={mailSelectedUserId}
                      onChange={e => setMailSelectedUserId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#0a0a0f',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#fff',
                      }}
                    >
                      <option value="">-- Выберите пользователя --</option>
                      {mailingUserOptions.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>Тема письма:</label>
                <input
                  type="text"
                  className="form-input"
                  value={mailSubject}
                  onChange={e => setMailSubject(e.target.value)}
                  placeholder="Тема"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-gray)' }}>Текст письма (HTML поддерживается):</label>
                <textarea
                  className="form-input"
                  rows={8}
                  value={mailBody}
                  onChange={e => setMailBody(e.target.value)}
                  placeholder="Введите текст письма. Можно использовать HTML."
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={sendMailing}
                  disabled={mailSending}
                  style={{
                    padding: '12px 28px',
                    background: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 600,
                    color: '#0a0a0a',
                    cursor: mailSending ? 'not-allowed' : 'pointer',
                    opacity: mailSending ? 0.7 : 1,
                  }}
                >
                  {mailSending ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Отправка...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane" /> Отправить
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {section === 'promos' && <AdminPromoTab paginateReset={paginateReset} />}
          {section === 'referrals' && <AdminReferralsTab paginateReset={paginateReset} />}
      </AdminLayout>

      <AnimatePresence>
        {editUser && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditUser(null)}
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
          >
            <motion.div
              className="modal-card"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0f1117',
                borderRadius: 32,
                padding: 32,
                maxWidth: 500,
                width: '90%',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#fff' }}>
                <i className="fas fa-user-edit" style={{ marginRight: 12, color: '#ffffff' }} /> Редактирование
              </h2>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Имя</label>
                <input
                  className="form-input"
                  value={euUsername}
                  onChange={e => setEuUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Почта</label>
                <input
                  className="form-input"
                  type="email"
                  value={euEmail}
                  onChange={e => setEuEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Пароль (пусто=не менять)</label>
                <input
                  className="form-input"
                  type="password"
                  value={euPassword}
                  onChange={e => setEuPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Баланс (₽)</label>
                <input
                  className="form-input"
                  type="number"
                  value={euBalance}
                  onChange={e => setEuBalance(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Роль</label>
                <select
                  className="form-input"
                  value={euRole}
                  onChange={e => setEuRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                >
                  <option value="user">Юзер</option>
                  <option value="support">Саппорт</option>
                  <option value="admin">Админ</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={euBlocked}
                    onChange={e => setEuBlocked(e.target.checked)}
                  />
                  Заблокировать аккаунт
                </label>
              </div>
              {euBlocked && (
                <>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ color: '#fff' }}>Причина блокировки</label>
                    <textarea
                      className="form-input"
                      value={euBanReason}
                      onChange={e => setEuBanReason(e.target.value)}
                      rows={3}
                      placeholder="Нарушение правил, мошенничество…"
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#0a0a0f',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#fff',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  {isAdmin && (
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#fff', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={euBanByIp}
                          onChange={e => setEuBanByIp(e.target.checked)}
                          style={{ marginTop: 4 }}
                        />
                        <span>
                          Заблокировать по IP
                          <span style={{ display: 'block', fontSize: 12, color: '#71717a', marginTop: 4 }}>
                            {editUser.lastLoginIp
                              ? `Последний IP: ${editUser.lastLoginIp}`
                              : 'IP неизвестен — пользователь ещё не входил после обновления'}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}
              <div style={{ marginBottom: 24 }} />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditUser(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#fff',
                  }}
                >
                  Отмена
                </button>
                <button
                  className="btn btn-fill"
                  onClick={saveEditUser}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    background: '#ffffff',
                    border: 'none',
                    color: '#000',
                  }}
                >
                  <i className="fas fa-save" /> Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {extendServer && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExtendServer(null)}
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
          >
            <motion.div
              className="modal-card"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0f1117',
                borderRadius: 32,
                padding: 32,
                maxWidth: 450,
                width: '90%',
              }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, color: '#fff' }}>Продление сервера</h2>
              <p style={{ marginBottom: 20, color: 'var(--text-dim)' }}>
                Сервер: <strong>{extendServer.name}</strong>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    onClick={() => setExtendMonths(m)}
                    style={{
                      padding: '16px',
                      borderRadius: 24,
                      border: `2px solid ${extendMonths === m ? '#ffffff' : 'rgba(255,255,255,0.1)'}`,
                      background: extendMonths === m ? 'rgba(59,130,246,0.2)' : 'transparent',
                      color: extendMonths === m ? '#fff' : 'var(--text-dim)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{m}</div>
                    <div style={{ fontSize: 12 }}>{m === 1 ? 'месяц' : m < 5 ? 'месяца' : 'месяцев'}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setExtendServer(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#fff',
                  }}
                >
                  Отмена
                </button>
                <button
                  className="btn btn-fill"
                  onClick={doExtend}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    background: '#ffffff',
                    border: 'none',
                    color: '#000',
                  }}
                >
                  Продлить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {editServer && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditServer(null)}
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
          >
            <motion.div
              className="modal-card"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0f1117',
                borderRadius: 32,
                padding: 32,
                maxWidth: 600,
                width: '90%',
              }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Редактирование сервера</h2>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Название</label>
                <input
                  className="form-input"
                  value={esName}
                  onChange={e => setEsName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Тариф</label>
                <select
                  className="form-input"
                  value={esTariffId}
                  onChange={handleTariffChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                >
                  <option value="">— Без тарифа —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.tier} {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label>RAM (МБ)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={esRam}
                    onChange={e => setEsRam(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label>CPU (ядра)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={esCores}
                    onChange={e => setEsCores(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label>Диск (МБ)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={esDisk}
                    onChange={e => setEsDisk(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label>Цена (₽/мес)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={esPrice}
                    onChange={e => setEsPrice(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Продлить на дней</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="0"
                  value={esExtendDays}
                  onChange={e => setEsExtendDays(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditServer(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#fff',
                  }}
                >
                  Отмена
                </button>
                <button
                  className="btn btn-fill"
                  onClick={saveEditServer}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    background: '#ffffff',
                    border: 'none',
                    color: '#000',
                  }}
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteAllModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteAllModal(false)}
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
          >
            <motion.div
              className="modal-card"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0f1117',
                borderRadius: 32,
                padding: 32,
                maxWidth: 450,
                width: '90%',
                textAlign: 'center',
              }}
            >
              <i className="fas fa-exclamation-triangle" style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }} />
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Удалить все тикеты?</h2>
              <p style={{ marginBottom: 24, color: 'var(--text-dim)' }}>
                Вы уверены, что хотите удалить <strong>все</strong> тикеты и сообщения? Это действие необратимо.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowDeleteAllModal(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#fff',
                  }}
                >
                  Отмена
                </button>
                <button
                  className="btn btn-fill"
                  onClick={deleteAllTickets}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 30,
                    background: '#ef4444',
                    border: 'none',
                    color: '#fff',
                  }}
                >
                  Удалить всё
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {planModal}
    </>
  );
}