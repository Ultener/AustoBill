// ============ TYPES ============
export interface BanInfo {
  reason: string;
  byIp: boolean;
}

export class ApiError extends Error {
  code?: string;
  ban?: BanInfo;
  errorId?: string;
  stage?: string;
  refunded?: boolean;

  constructor(message: string, payload?: { code?: string; ban?: BanInfo; errorId?: string; stage?: string; refunded?: boolean }) {
    super(message);
    this.name = 'ApiError';
    this.code = payload?.code;
    this.ban = payload?.ban;
    this.errorId = payload?.errorId;
    this.stage = payload?.stage;
    this.refunded = payload?.refunded;
  }
}

export interface User {
  id: string;
  username: string;
  email: string;
  balance: number;
  isAdmin: boolean;
  role: 'user' | 'admin' | 'support';
  blocked: boolean;
  createdAt: string;
  pterodactylUserId?: number;
  verified?: boolean;
  twoFactorEnabled?: boolean;
  banReason?: string | null;
  banByIp?: boolean;
  lastLoginIp?: string | null;
}

export interface GameServer {
  id: string;
  userId: string;
  name: string;
  tariffId: string;
  tariffName: string;
  tariffTier: string;
  type: string;
  coreName: string;
  status: 'active' | 'suspended' | 'expired';
  ram: number;
  cores: number;
  disk: number;
  price: number;
  months: number;
  expiresAt: string;
  createdAt: string;
  ip?: string;
  port?: number;
  node?: number;
  pterodactylServerId?: number;
  pterodactylIdentifier?: string;
  pterodactylUuid?: string;
  autoRenew?: boolean;
}

export interface Tariff {
  id: string;
  name: string;
  tier: string;
  type: string;
  price: number;
  ram: number;
  cores: number;
  disk: number;
  features: string[];
  popular: boolean;
  icon: string;
  description: string;
  once_per_account?: boolean;
  node_id?: number | null;
}

export interface PromoCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed' | 'balance';
  value: number;
  max_uses: number | null;
  used_count: number;
  per_user_limit: number;
  min_amount: number;
  expires_at: string | null;
  active: number;
  created_at: string;
}

export interface ReferralRegistration {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  referred_by: string;
  referrer_username?: string;
  referrer_email?: string;
}

export interface Ticket {
  id: string;
  userId: string;
  username: string;
  subject: string;
  category: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  isStaff: boolean;
  content: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  operation_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
  status?: ReviewStatus;
  message?: string;
}

// Ядра для игровых серверов
export const GAME_CORES = [
  { id: 'paper', name: 'Paper', icon: 'fa-scroll', desc: 'Высокопроизводительный форк Spigot' },
  { id: 'purpur', name: 'Purpur', icon: 'fa-gem', desc: 'Форк Paper с дополнительными фичами' },
  { id: 'vanilla', name: 'Vanilla', icon: 'fa-cube', desc: 'Оригинальный сервер Minecraft' },
  { id: 'forge', name: 'Forge', icon: 'fa-wrench', desc: 'Для модов Minecraft' },
  { id: 'fabric', name: 'Fabric', icon: 'fa-layer-group', desc: 'Легковесный загрузчик модов' },
  { id: 'spigot', name: 'Spigot', icon: 'fa-bolt', desc: 'Популярный сервер с плагинами' },
];

// Ядра для кодинг серверов (Node.js, Python, Go, PHP, Rust, Static)
export const CODING_CORES = [
  { 
    id: 'nodejs', 
    name: 'Node.js', 
    desc: 'JavaScript runtime', 
    icon: 'fa-brands fa-node-js', 
    color: '#339933' 
  },
  { 
    id: 'python', 
    name: 'Python', 
    desc: 'Python 3', 
    icon: 'fa-brands fa-python', 
    color: '#3776AB' 
  },
  { 
    id: 'go', 
    name: 'Go', 
    desc: 'Golang', 
    icon: 'fa-brands fa-golang', 
    color: '#00ADD8' 
  },
  { 
    id: 'php', 
    name: 'PHP', 
    desc: 'PHP 8', 
    icon: 'fa-brands fa-php', 
    color: '#777BB4' 
  },
  { 
    id: 'rust', 
    name: 'Rust', 
    desc: 'Rust', 
    icon: 'fa-brands fa-rust', 
    color: '#000000' 
  },
  { 
    id: 'java', 
    name: 'Java', 
    desc: 'Java', 
    icon: 'fa-brands fa-java', 
    color: '#007396' 
  },
];

export const TICKET_CATEGORIES = [
  'Техническая проблема', 'Вопрос по оплате', 'Запрос функции', 'Жалоба', 'Другое',
];

// ============ API CLIENT ============
function getToken(): string | null {
  return localStorage.getItem('lmx_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('lmx_token', token);
  else localStorage.removeItem('lmx_token');
}

async function api(method: string, url: string, body?: unknown, options?: { timeoutMs?: number }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const opts: RequestInit = { method, headers, signal: controller.signal };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fallbackMessage = data.error
        || (data.code === 'no_allocations'
          ? 'На выбранной локации нет свободных портов. Попробуйте позже или обратитесь в поддержку.'
          : res.status === 504 || res.status === 502
            ? 'Сервер не ответил вовремя. Попробуйте ещё раз.'
            : res.status === 503
              ? 'Сервис временно недоступен. Попробуйте через несколько секунд.'
              : `HTTP ${res.status}`);
      throw new ApiError(data.error || fallbackMessage, {
        code: data.code,
        ban: data.ban,
        errorId: data.errorId,
        stage: data.stage,
        refunded: data.refunded,
      });
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Сервер не ответил вовремя. Попробуйте ещё раз.');
    }
    throw new ApiError('Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.');
  } finally {
    clearTimeout(timeoutId);
  }
}

// Auth
export const authApi = {
  login: (email: string, password: string, recaptchaToken?: string) =>
    api('POST', '/api/auth/login', { email, password, recaptchaToken }, { timeoutMs: 25000 }),
  register: (username: string, email: string, password: string, recaptchaToken?: string, ref?: string) =>
    api('POST', '/api/auth/register', { username, email, password, recaptchaToken, ref }),
  verify: (email: string, code: string) =>
    api('POST', '/api/auth/verify', { email, code }),
  forgot: (email: string) =>
    api('POST', '/api/auth/forgot', { email }),
  reset: (email: string, code: string, newPassword: string) =>
    api('POST', '/api/auth/reset', { email, code, newPassword }),
  me: () => api('GET', '/api/auth/me'),
  logout: () => api('POST', '/api/auth/logout'),
  updateProfile: (data: { username?: string; email?: string }) =>
    api('PUT', '/api/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api('PUT', '/api/auth/password', { currentPassword, newPassword }),

  // 2FA methods
  twoFactorStatus: () => api('GET', '/api/auth/2fa/status'),
  twoFactorEnable: () => api('POST', '/api/auth/2fa/enable', {}),
  twoFactorVerify: (token: string) => api('POST', '/api/auth/2fa/verify', { token }),
  twoFactorDisable: (password: string) => api('POST', '/api/auth/2fa/disable', { password }),
  twoFactorVerifyLogin: (tempToken: string, code: string) =>
    api('POST', '/api/auth/2fa/verify-login', { tempToken, code }),
};

// Plans
export const plansApi = {
  list: (): Promise<Tariff[]> => api('GET', '/api/plans'),
  create: (data: Partial<Tariff>) => api('POST', '/api/plans', data),
  update: (id: string, data: Partial<Tariff>) => api('PUT', `/api/plans/${id}`, data),
  delete: (id: string) => api('DELETE', `/api/plans/${id}`),
};

// Servers
export const serversApi = {
  list: (): Promise<GameServer[]> => api('GET', '/api/servers'),
  get: (id: string): Promise<GameServer> => api('GET', `/api/servers/${id}`),
  create: (data: Record<string, unknown>) => api('POST', '/api/servers', data),
  update: (id: string, data: Record<string, unknown>) => api('PUT', `/api/servers/${id}`, data),
  delete: (id: string) => api('DELETE', `/api/servers/${id}`),
  renew: (id: string, months: number) => api('POST', `/api/servers/${id}/renew`, { months }),
  changeTariff: (id: string, tariffId: string): Promise<{ server: GameServer; user: User }> => 
    api('POST', `/api/servers/${id}/change-tariff`, { tariffId }),
};

// Tickets
export const ticketsApi = {
  list: (): Promise<Ticket[]> => api('GET', '/api/tickets'),
  create: (subject: string, category: string, message: string) => api('POST', '/api/tickets', { subject, category, message }),
  reply: (id: string, content: string) => api('POST', `/api/tickets/${id}/messages`, { content }),
  close: (id: string) => api('PUT', `/api/tickets/${id}`, { status: 'closed' }),
  markRead: (id: string) => api('POST', `/api/tickets/${id}/mark-read`),
  uploadImage: (image: string): Promise<{ url: string }> => api('POST', '/api/tickets/upload-image', { image }),
};

export interface TicketReplyNotification {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
}

export const notificationsApi = {
  get: (): Promise<{ ticketReplies: TicketReplyNotification[]; unreadTickets: number }> =>
    api('GET', '/api/notifications'),
};

// Admin
export const adminApi = {
  users: (): Promise<User[]> => api('GET', '/api/admin/users'),
  updateUser: (id: string, data: {
    username?: string;
    email?: string;
    password?: string;
    balance?: number;
    role?: 'user' | 'admin' | 'support';
    blocked?: boolean;
    banReason?: string;
    banByIp?: boolean;
    twoFactorEnabled?: boolean;
  }) => api('PUT', `/api/admin/users/${id}`, data),
  deleteUser: (id: string) => api('DELETE', `/api/admin/users/${id}`),
  updateServer: (id: string, data: Record<string, unknown>) => api('PUT', `/api/admin/servers/${id}`, data),
  deleteServer: (id: string) => api('DELETE', `/api/admin/servers/${id}`),
  deleteTicket: (id: string) => api('DELETE', `/api/admin/tickets/${id}`),
  deleteAllTickets: () => api('DELETE', '/api/admin/tickets'),
};

// TopUp / Payments
export const topupApi = {
  add: (amount: number) => api('POST', '/api/topup', { amount }),
};

export const yoomoneyApi = {
  create: (amount: number) =>
    api('POST', '/api/yoomoney/create', { amount }) as Promise<{ payment_url: string; order_id: string }>,
};

// Transactions
export const transactionsApi = {
  list: (): Promise<Transaction[]> => api('GET', '/api/transactions'),
};

// Pterodactyl
export const pteroApi = {
  test: () => api('GET', '/api/ptero/test') as Promise<{ success: boolean; total_servers?: number; error?: string }>,
  servers: () => api('GET', '/api/ptero/servers'),
  users: () => api('GET', '/api/ptero/users'),
  suspend: (id: number) => api('POST', `/api/ptero/servers/${id}/suspend`),
  unsuspend: (id: number) => api('POST', `/api/ptero/servers/${id}/unsuspend`),
  deleteServer: (id: number) => api('DELETE', `/api/ptero/servers/${id}`),
  provision: (data: Record<string, unknown>) => api('POST', '/api/ptero/provision', data, { timeoutMs: 180000 }) as Promise<{
    success: boolean;
    error?: string;
    errorId?: string;
    stage?: string;
    refunded?: boolean;
    code?: string;
    pterodactylUserId?: number;
    server?: { id: number; identifier: string; uuid: string; name: string; node: number; ip: string; port: number };
  }>,
  purchaseLocations: () => api('GET', '/api/purchase-locations') as Promise<Array<{
    nodeId: number;
    label: string;
    shortLabel: string;
    overloaded?: boolean;
    overloadedMessage?: string | null;
  }>>,
};

// Promo
export const promoApi = {
  validate: (code: string, amount: number, context: 'purchase' | 'topup' = 'purchase') =>
    api('POST', '/api/promo/validate', { code, amount, context }) as Promise<{
      valid: boolean; discount: number; finalAmount: number; message: string; type: string;
    }>,
  activate: (code: string) =>
    api('POST', '/api/promo/activate', { code }) as Promise<{ success: boolean; credited: number; balance: number; message: string }>,
};

export const promoAdminApi = {
  list: (): Promise<PromoCode[]> => api('GET', '/api/admin/promo'),
  create: (data: Partial<PromoCode> & { code: string; type: string; value: number }) => api('POST', '/api/admin/promo', data),
  update: (id: string, data: Partial<PromoCode>) => api('PUT', `/api/admin/promo/${id}`, data),
  delete: (id: string) => api('DELETE', `/api/admin/promo/${id}`),
};

export const referralsApi = {
  me: () => api('GET', '/api/referrals/me') as Promise<{ count: number; referrals: { id: string; username: string; email: string; createdAt: string }[]; link: string }>,
  admin: () => api('GET', '/api/admin/referrals') as Promise<{ summary: { referrer_id: string; referrer_username: string; referral_count: number }[]; registrations: ReferralRegistration[] }>,
};

// ============ REVIEWS API ============
export const reviewsApi = {
  // Публичные отзывы
  list: (limit: number = 10): Promise<Review[]> => 
    api('GET', `/api/reviews?limit=${limit}`),

  // Создать отзыв
  create: (rating: number, text: string): Promise<Review & { message?: string }> => 
    api('POST', '/api/reviews', { rating, text }),

  // Отзывы текущего пользователя
  userReviews: (): Promise<Review[]> => 
    api('GET', '/api/user/reviews'),

  // Админские методы
  adminList: (): Promise<(Review & { email: string })[]> => 
    api('GET', '/api/admin/reviews'),

  adminDelete: (id: string): Promise<{ success: boolean }> => 
    api('DELETE', `/api/admin/reviews/${id}`),

  adminApprove: (id: string): Promise<{ success: boolean }> =>
    api('POST', `/api/admin/reviews/${id}/approve`),

  adminReject: (id: string): Promise<{ success: boolean }> =>
    api('POST', `/api/admin/reviews/${id}/reject`),
};