import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import speakeasy from 'speakeasy';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import morgan from 'morgan';
import validator from 'validator';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import https from 'https';
import {
  validateServerName,
  validatePlanPayload,
  validatePlanRecord,
  validateReviewInput,
  validateTicketSubject,
  sanitizeTicketText,
  parseMoneyAmount,
  parseRenewMonths,
  calcRenewalCost,
  validateUsername,
  validateEmail,
  validateRoleForActor,
  parseBalance,
  canAccessServer,
  canAccessTicket,
  validateTicketStatus,
  validateBanReason,
  safeTimingEqual,
  isStaffUser,
} from './server/security.js';
import {
  buildVerificationEmail,
  buildResetPasswordEmail,
  buildPterodactylCredentialsEmail,
  buildVdsReadyEmail,
  buildGameServerReadyEmail,
  buildTicketReplyEmail,
  buildBanEmail,
} from './server/emails.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(cookieParser());

// ========== APP NAME ==========
const APP_NAME = process.env.APP_NAME;

// ========== DISCORD OAUTH2 CONFIG ==========
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;
const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

// ========== SECURITY MIDDLEWARES ==========
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://www.google.com',
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),
  ...(FRONTEND_URL && FRONTEND_URL.startsWith('https://') ? [FRONTEND_URL.replace('https://', 'https://panel.')] : []),
  ...(FRONTEND_URL && FRONTEND_URL.startsWith('https://') ? [FRONTEND_URL.replace('https://', 'http://')] : []),
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const logStream = fs.createWriteStream(join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: logStream }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Повторите позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const sensitiveApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Слишком много запросов. Подождите минуту.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));

const TICKET_UPLOAD_DIR = join(__dirname, 'uploads', 'tickets');
if (!existsSync(TICKET_UPLOAD_DIR)) {
  fs.mkdirSync(TICKET_UPLOAD_DIR, { recursive: true });
}

// ========== DISCORD LOGGING ==========
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

async function sendDiscordLog(embed) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[DISCORD LOG] Failed:', response.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error('[DISCORD LOG] Failed to send:', e.message);
  }
}

// ========== ERROR LOGGING ==========
const errorLogStream = fs.createWriteStream(join(__dirname, 'error.log'), { flags: 'a' });
const SENSITIVE_KEY_RE = /password|secret|token|authorization|encryptedpassword/i;

function genErrorRef() {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function maskSensitiveData(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.replace(/(password|passwd|secret|token)=[^&]*/gi, '$1=***');
  }
  if (Array.isArray(value)) return value.map(maskSensitiveData);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? '***' : maskSensitiveData(val);
    }
    return out;
  }
  return value;
}

function logError(tag, message, context = {}) {
  const { stack, ...rest } = context;
  const safeContext = maskSensitiveData(rest);
  const entry = {
    ts: new Date().toISOString(),
    tag,
    message,
    ...safeContext,
    ...(stack ? { stack: String(stack).slice(0, 4000) } : {}),
  };
  errorLogStream.write(`${JSON.stringify(entry)}\n`);
  console.error(`[${tag}]`, message, safeContext);
  if (stack) console.error(`[${tag}] stack:`, stack);
  return entry;
}

// ========== ENCRYPTION CONFIG ==========
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  console.warn('[SECURITY] ENCRYPTION_KEY не задан. Сгенерирован временный ключ:', ENCRYPTION_KEY);
  console.warn('[SECURITY] Установите ENCRYPTION_KEY в .env для сохранения паролей между перезапусками!');
}
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encryptPassword(password) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPassword(encrypted) {
  if (!encrypted) return null;
  const parts = encrypted.split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ══════════════════════════════════════════════════
// SMTP CONFIGURATION
// ══════════════════════════════════════════════════
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.SMTP_FROM,
};

let transporter;
try {
  transporter = nodemailer.createTransport(smtpConfig);
  console.log('[SMTP] Configured');
} catch (e) {
  console.error('[SMTP] Configuration error:', e.message);
}

// ══════════════════════════════════════════════════
// RECAPTCHA CONFIGURATION
// ══════════════════════════════════════════════════
const RECAPTCHA_ENABLED = process.env.RECAPTCHA_ENABLED === 'true';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
// Если сервер не может достучаться до Google (fetch failed), пропускаем проверку
// при наличии токена с клиента. Защита остаётся через authLimiter.
const RECAPTCHA_FAIL_OPEN_ON_NETWORK_ERROR = process.env.RECAPTCHA_FAIL_OPEN_ON_NETWORK_ERROR !== 'false';

// ══════════════════════════════════════════════════
// PTERODACTYL CONFIGURATION
// ══════════════════════════════════════════════════
const PTERO_URL = process.env.PTERO_URL;
const PTERO_ADMIN_KEY = process.env.PTERO_ADMIN_KEY;
const PTERO_PURCHASE_NODE_IDS = [1, 2];
const DEFAULT_PTERO_NODE_ID = 1;
/** Временно закрытые для покупки ноды (синхронизировать с src/lib/locations.ts) */
const OVERLOADED_PTERO_NODE_IDS = [2];

function isAllowedPteroNode(nodeId) {
  return PTERO_PURCHASE_NODE_IDS.includes(Number(nodeId));
}

function isPteroNodeOverloaded(nodeId) {
  return OVERLOADED_PTERO_NODE_IDS.includes(Number(nodeId));
}

function getPteroLocationLabel(nodeId) {
  if (Number(nodeId) === 1) return 'Германия 1';
  if (Number(nodeId) === 2) return 'Германия 2';
  return `нода ${nodeId}`;
}

function getPteroNodeOverloadMessage(nodeId) {
  if (Number(nodeId) === 1) return 'Локация Германия 1 временно переполнена. Выберите Германию 2.';
  if (Number(nodeId) === 2) return 'Локация Германия 2 переполнена — нет свободных портов. Попробуйте позже или обратитесь в поддержку.';
  return 'Выбранная локация временно переполнена. Выберите другую.';
}

function getNoAllocationsUserMessage(nodeId) {
  return getPteroNodeOverloadMessage(nodeId);
}

function makeNoAllocationsError(nodeId) {
  return Object.assign(
    new Error(`Нет свободных аллокаций на ноде ${nodeId}`),
    { status: 503, code: 'no_allocations', nodeId: Number(nodeId) },
  );
}

function isAllocationFree(alloc) {
  const attrs = alloc?.attributes;
  if (!attrs) return false;
  if (attrs.assigned === true) return false;
  if (attrs.server_id != null && Number(attrs.server_id) !== 0) return false;
  return true;
}

async function fetchNodeAllocations(nodeId) {
  const id = Number(nodeId);
  const perPage = 500;
  let page = 1;
  const all = [];
  while (true) {
    const res = await ptero(
      'GET',
      `/nodes/${id}/allocations?per_page=${perPage}&page=${page}`,
      null,
      { timeoutMs: 20000 },
    );
    const batch = res.data || [];
    all.push(...batch);
    const totalPages = res?.meta?.pagination?.total_pages ?? 1;
    if (page >= totalPages || batch.length < perPage) break;
    page++;
  }
  return all;
}

async function countFreeNodeAllocations(nodeId) {
  const all = await fetchNodeAllocations(nodeId);
  return all.filter(isAllocationFree).length;
}

async function findFreeNodeAllocation(nodeId) {
  const all = await fetchNodeAllocations(nodeId);
  return all.find(isAllocationFree) ?? null;
}

async function isPteroNodeCapacityAvailable(nodeId) {
  if (isPteroNodeOverloaded(nodeId)) return false;
  try {
    return (await countFreeNodeAllocations(nodeId)) > 0;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════
// PROXMOX CONFIGURATION
// ══════════════════════════════════════════════════
const PROXMOX_CONFIG = {
  host: process.env.PROXMOX_HOST,
  tokenId: process.env.PROXMOX_TOKEN_ID,
  tokenSecret: process.env.PROXMOX_TOKEN_SECRET,
  node: process.env.PROXMOX_NODE,
  storage: process.env.PROXMOX_STORAGE || 'local',
  template: process.env.PROXMOX_TEMPLATE,
  verifySSL: process.env.PROXMOX_VERIFY_SSL === 'true',
};

// ══════════════════════════════════════════════════
// DATABASE SETUP (SQLite)
// ══════════════════════════════════════════════════
const db = new Database(join(__dirname, 'luminarix.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    balance REAL DEFAULT 0,
    role TEXT DEFAULT 'user' CHECK(role IN ('user','admin','support')),
    blocked INTEGER DEFAULT 0,
    pterodactylUserId INTEGER,
    verified INTEGER DEFAULT 0,
    twoFactorSecret TEXT,
    twoFactorEnabled INTEGER DEFAULT 0,
    lastTicketAt TEXT,
    discordId TEXT UNIQUE,
    pteroPassword TEXT,
    encryptedPassword TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    tariffId TEXT,
    tariffName TEXT,
    tariffTier TEXT,
    type TEXT DEFAULT 'game',
    coreName TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','expired')),
    ram INTEGER DEFAULT 0,
    cores INTEGER DEFAULT 0,
    disk INTEGER DEFAULT 0,
    price REAL DEFAULT 0,
    months INTEGER DEFAULT 1,
    expiresAt TEXT,
    ip TEXT,
    port INTEGER,
    node INTEGER,
    pterodactylServerId INTEGER,
    pterodactylIdentifier TEXT,
    pterodactylUuid TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    autoRenew INTEGER DEFAULT 0,
    deletionPending INTEGER DEFAULT 0,
    os_template TEXT DEFAULT NULL,
    proxmoxPassword TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    subject TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY,
    ticketId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    authorName TEXT,
    isStaff INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    type TEXT DEFAULT 'game',
    price REAL NOT NULL,
    ram INTEGER NOT NULL,
    cores INTEGER NOT NULL,
    disk INTEGER NOT NULL,
    features TEXT DEFAULT '[]',
    popular INTEGER DEFAULT 0,
    icon TEXT DEFAULT 'fa-cube',
    description TEXT DEFAULT '',
    sortOrder INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    once_per_account INTEGER DEFAULT 0,
    node_id INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    operation_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS temp_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS temp_payments (
    order_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS provision_grants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    external_id TEXT NOT NULL,
    server_type TEXT NOT NULL,
    tariff_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    used INTEGER DEFAULT 0,
    UNIQUE(user_id, external_id)
  );

  CREATE TABLE IF NOT EXISTS once_purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tariff_id TEXT NOT NULL,
    purchased_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tariff_id) REFERENCES plans(id) ON DELETE CASCADE,
    UNIQUE(user_id, tariff_id)
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('percent','fixed','balance')),
    value REAL NOT NULL,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    min_amount REAL DEFAULT 0,
    expires_at TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promo_redemptions (
    id TEXT PRIMARY KEY,
    promo_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    context TEXT DEFAULT 'purchase',
    amount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ========== НАДЁЖНОЕ ДОБАВЛЕНИЕ КОЛОНОК (если их нет) ==========
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const columnNames = tableInfo.map(col => col.name);

  if (!columnNames.includes('discordId')) {
    db.prepare("ALTER TABLE users ADD COLUMN discordId TEXT").run();
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discordId ON users(discordId)").run();
  }
  if (!columnNames.includes('verified')) {
    db.prepare("ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 1").run();
  }
  if (!columnNames.includes('twoFactorSecret')) {
    db.prepare("ALTER TABLE users ADD COLUMN twoFactorSecret TEXT").run();
  }
  if (!columnNames.includes('twoFactorEnabled')) {
    db.prepare("ALTER TABLE users ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0").run();
  }
  if (!columnNames.includes('lastTicketAt')) {
    db.prepare("ALTER TABLE users ADD COLUMN lastTicketAt TEXT").run();
  }
  if (!columnNames.includes('pteroPassword')) {
    db.prepare("ALTER TABLE users ADD COLUMN pteroPassword TEXT").run();
  }
  if (!columnNames.includes('encryptedPassword')) {
    db.prepare("ALTER TABLE users ADD COLUMN encryptedPassword TEXT").run();
  }
  if (!columnNames.includes('referred_by')) {
    db.prepare("ALTER TABLE users ADD COLUMN referred_by TEXT").run();
  }
  if (!columnNames.includes('ban_reason')) {
    db.prepare('ALTER TABLE users ADD COLUMN ban_reason TEXT').run();
  }
  if (!columnNames.includes('ban_by_ip')) {
    db.prepare('ALTER TABLE users ADD COLUMN ban_by_ip INTEGER DEFAULT 0').run();
  }
  if (!columnNames.includes('last_login_ip')) {
    db.prepare('ALTER TABLE users ADD COLUMN last_login_ip TEXT').run();
  }

  const serverTableInfo = db.prepare("PRAGMA table_info(servers)").all();
  const serverColumns = serverTableInfo.map(col => col.name);
  if (!serverColumns.includes('autoRenew')) {
    db.prepare("ALTER TABLE servers ADD COLUMN autoRenew INTEGER DEFAULT 0").run();
  }
  if (!serverColumns.includes('deletionPending')) {
    db.prepare("ALTER TABLE servers ADD COLUMN deletionPending INTEGER DEFAULT 0").run();
  }
  if (!serverColumns.includes('os_template')) {
    db.prepare("ALTER TABLE servers ADD COLUMN os_template TEXT DEFAULT NULL").run();
  }
  if (!serverColumns.includes('proxmoxPassword')) {
    db.prepare("ALTER TABLE servers ADD COLUMN proxmoxPassword TEXT").run();
  }

  const plansTableInfo = db.prepare("PRAGMA table_info(plans)").all();
  if (!plansTableInfo.map(c => c.name).includes('type')) {
    db.prepare("ALTER TABLE plans ADD COLUMN type TEXT DEFAULT 'game'").run();
  }
  if (!plansTableInfo.map(c => c.name).includes('once_per_account')) {
    db.prepare("ALTER TABLE plans ADD COLUMN once_per_account INTEGER DEFAULT 0").run();
  }
  if (!plansTableInfo.map(c => c.name).includes('node_id')) {
    db.prepare("ALTER TABLE plans ADD COLUMN node_id INTEGER DEFAULT NULL").run();
  }

  const reviewsTableInfo = db.prepare("PRAGMA table_info(reviews)").all();
  if (!reviewsTableInfo.map(c => c.name).includes('status')) {
    db.prepare("ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'approved'").run();
    db.prepare("UPDATE reviews SET status = 'approved' WHERE status IS NULL OR status = ''").run();
    console.log('[DB] Added reviews.status column');
  }

  const ticketsTableInfo = db.prepare("PRAGMA table_info(tickets)").all();
  if (!ticketsTableInfo.map(c => c.name).includes('unread_for_user')) {
    db.prepare('ALTER TABLE tickets ADD COLUMN unread_for_user INTEGER DEFAULT 0').run();
    console.log('[DB] Added tickets.unread_for_user column');
  }

  const tempPayInfo = db.prepare('PRAGMA table_info(temp_payments)').all();
  if (!tempPayInfo.map(c => c.name).includes('gateway_ref')) {
    db.prepare('ALTER TABLE temp_payments ADD COLUMN gateway_ref TEXT').run();
    console.log('[DB] Added temp_payments.gateway_ref column');
  }
  if (!tempPayInfo.map(c => c.name).includes('payment_method')) {
    db.prepare('ALTER TABLE temp_payments ADD COLUMN payment_method TEXT').run();
    console.log('[DB] Added temp_payments.payment_method column');
  }
} catch (e) { console.error('[DB] Error adding columns:', e.message); }

db.exec(`
  CREATE TABLE IF NOT EXISTS banned_ips (
    ip TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Удаление битых тарифов (null / exploit)
try {
  const brokenPlans = db.prepare(`
    SELECT id FROM plans
    WHERE name IS NULL OR tier IS NULL OR price IS NULL OR ram IS NULL OR cores IS NULL OR disk IS NULL
       OR ram < 1 OR cores < 1 OR disk < 1 OR price < 0
  `).all();
  for (const row of brokenPlans) {
    db.prepare('DELETE FROM plans WHERE id = ?').run(row.id);
    console.warn('[DB] Removed invalid plan:', row.id);
  }
} catch (e) {
  console.error('[DB] Plan cleanup error:', e.message);
}

// ══════════════════════════════════════════════════
// SEED: Default admin + plans
// ══════════════════════════════════════════════════
function genId() { return Math.random().toString(36).substring(2, 11) + Date.now().toString(36); }

const TICKET_AUTO_REPLY_AUTHOR_ID = 'system';

function formatTicketNumber(ticketId) {
  const short = ticketId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return short || ticketId.slice(0, 8);
}

function buildTicketAutoReplyMessage(ticketId, appName = 'AustoCloud') {
  const num = formatTicketNumber(ticketId);
  return (
    `Здравствуйте!\n\n` +
    `Спасибо, что обратились в службу поддержки ${appName}. Ваше обращение зарегистрировано.\n\n` +
    `Номер тикета: #${num}\n\n` +
    `Мы уже видим ваш запрос и ответим, как только освободится специалист. ` +
    `Обычно ответ приходит в течение 10 минут — до 2 рабочих дней.\n\n` +
    `Режим работы техподдержки:\n` +
    `• Понедельник — пятница: 8:00–22:00\n` +
    `• Суббота — воскресенье: 10:00–00:00\n\n` +
    `Пожалуйста, не создавайте дублирующие тикеты по той же проблеме — это замедляет обработку и увеличивает очередь.\n` +
    `Опишите ситуацию как можно подробнее в этом обращении.\n\n` +
    `Спасибо за понимание!`
  );
}
function genCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase();
}

function validatePromoForUser(promo, userId, amount, context) {
  if (!promo || promo.active !== 1) return { ok: false, error: 'Промокод не найден или неактивен' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { ok: false, error: 'Срок действия промокода истёк' };
  }
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return { ok: false, error: 'Промокод исчерпан' };
  }
  const userUses = db.prepare('SELECT COUNT(*) as c FROM promo_redemptions WHERE promo_id = ? AND user_id = ?').get(promo.id, userId);
  const limit = promo.per_user_limit ?? 1;
  if (userUses.c >= limit) {
    return { ok: false, error: 'Вы уже использовали этот промокод' };
  }
  const minAmount = promo.min_amount ?? 0;
  if (context === 'purchase' && amount < minAmount) {
    return { ok: false, error: `Минимальная сумма заказа: ${minAmount}₽` };
  }
  let discount = 0;
  let finalAmount = amount;
  if (promo.type === 'percent') {
    discount = Math.round((amount * promo.value / 100) * 100) / 100;
    finalAmount = Math.max(0, amount - discount);
  } else if (promo.type === 'fixed') {
    discount = Math.min(amount, promo.value);
    finalAmount = Math.max(0, amount - discount);
  } else if (promo.type === 'balance') {
    discount = promo.value;
    finalAmount = amount;
  }
  return { ok: true, promo, discount, finalAmount };
}

function redeemPromo(promoId, userId, context, amount) {
  db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?').run(promoId);
  db.prepare('INSERT INTO promo_redemptions (id, promo_id, user_id, context, amount) VALUES (?,?,?,?,?)')
    .run(genId(), promoId, userId, context, amount);
}

function creditPromoBalance(userId, amount) {
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO users (id, username, email, password, balance, role, verified) VALUES (?,?,?,?,?,?,?)').run(
      'admin_' + genId(), 'admin', ADMIN_EMAIL, hashedPassword, 99999, 'admin', 1
    );
    console.log('[DB] Admin account created');
  }
}

const plansExist = db.prepare('SELECT COUNT(*) as c FROM plans').get();
if (plansExist.c === 0) {
  const defaultPlans = [
    { id: 'game-rabbit', name: 'Lite', tier: 'Кролик', price: 39, ram: 3072, cores: 1, disk: 25600, features: JSON.stringify(['3 ГБ RAM','1 ядро','25 ГБ SSD','DDoS защита']), popular: 0, icon: 'fa-cube', description: 'Для небольших серверов', sortOrder: 1, type: 'game', once_per_account: 0, node_id: 1 },
    { id: 'game-sheep', name: 'Lite', tier: 'Овца', price: 79, ram: 4096, cores: 2, disk: 51200, features: JSON.stringify(['4 ГБ RAM','1.5 ядра','50 ГБ SSD','DDoS защита']), popular: 1, icon: 'fa-fire', description: 'Оптимальный для большинства', sortOrder: 2, type: 'game', once_per_account: 0, node_id: null },
    { id: 'game-premium', name: 'Ultimate', tier: 'Premium', price: 129, ram: 6144, cores: 2, disk: 76800, features: JSON.stringify(['6 ГБ RAM','2 ядра','75 ГБ SSD','DDoS защита']), popular: 0, icon: 'fa-crown', description: 'Максимум мощности', sortOrder: 3, type: 'game', once_per_account: 0, node_id: 1 },
  ];
  const ins = db.prepare('INSERT INTO plans (id,name,tier,type,price,ram,cores,disk,features,popular,icon,description,sortOrder,once_per_account,node_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of defaultPlans) { ins.run(p.id, p.name, p.tier, p.type, p.price, p.ram, p.cores, p.disk, p.features, p.popular, p.icon, p.description, p.sortOrder, p.once_per_account, p.node_id); }
  console.log('[DB] Default plans created');
}

// Миграция: тарифы game/coding доступны на всех нодах покупки (node_id = NULL)
try {
  db.prepare("UPDATE plans SET node_id = NULL WHERE type IN ('game', 'coding') AND node_id IS NOT NULL").run();
} catch (e) {
  console.warn('[DB] Multi-node plans migration skipped:', e.message);
}

// ══════════════════════════════════════════════════
// BAN HELPERS
// ══════════════════════════════════════════════════
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).trim();
  return req.ip || req.socket?.remoteAddress || '';
}

function normalizeIp(ip) {
  let s = String(ip || '').trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s;
}

function findIpBan(ip) {
  const n = normalizeIp(ip);
  if (!n) return null;
  return db.prepare('SELECT * FROM banned_ips WHERE ip = ?').get(n) || null;
}

function buildBanPayload(user, ipBanRow = null) {
  const reason = user?.ban_reason || ipBanRow?.reason || 'Нарушение правил сервиса';
  const byIp = !!(user?.ban_by_ip || ipBanRow);
  return {
    code: 'ACCOUNT_BANNED',
    error: `Ваш аккаунт заблокирован. Причина: ${reason}`,
    ban: { reason, byIp },
  };
}

function checkAccessBan(req, user = null) {
  const ipBan = findIpBan(getClientIp(req));
  if (ipBan) {
    const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(ipBan.user_id);
    return { banned: true, status: 403, payload: buildBanPayload(owner, ipBan) };
  }
  if (user?.blocked) {
    return { banned: true, status: 403, payload: buildBanPayload(user) };
  }
  return { banned: false };
}

function recordUserLoginIp(userId, req) {
  const ip = normalizeIp(getClientIp(req));
  if (ip) db.prepare('UPDATE users SET last_login_ip = ? WHERE id = ?').run(ip, userId);
}

function revokeUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId);
}

function upsertBannedIp(ip, userId, reason) {
  const n = normalizeIp(ip);
  if (!n) return false;
  db.prepare(`
    INSERT INTO banned_ips (ip, user_id, reason) VALUES (?, ?, ?)
    ON CONFLICT(ip) DO UPDATE SET user_id = excluded.user_id, reason = excluded.reason
  `).run(n, userId, reason);
  return true;
}

function clearUserBanData(userId) {
  db.prepare('UPDATE users SET blocked = 0, ban_reason = NULL, ban_by_ip = 0 WHERE id = ?').run(userId);
  db.prepare('DELETE FROM banned_ips WHERE user_id = ?').run(userId);
}

async function applyUserBan(user, { reason, banByIp }) {
  db.prepare('UPDATE users SET blocked = 1, ban_reason = ?, ban_by_ip = ? WHERE id = ?')
    .run(reason, banByIp ? 1 : 0, user.id);
  if (banByIp && user.last_login_ip) {
    upsertBannedIp(user.last_login_ip, user.id, reason);
  }
  revokeUserSessions(user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (updated.email && transporter) {
    try {
      await sendMailTemplate(updated.email, buildBanEmail(APP_NAME, {
        username: updated.username,
        reason,
        byIp: !!banByIp,
      }));
    } catch (e) {
      console.error('[BAN] Email failed:', e.message);
    }
  }
  return updated;
}

// ══════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ══════════════════════════════════════════════════
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Необходима авторизация' });
  const session = db.prepare('SELECT userId FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Сессия истекла' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  const banCheck = checkAccessBan(req, user);
  if (banCheck.banned) {
    revokeUserSessions(user.id);
    return res.status(banCheck.status).json(banCheck.payload);
  }
  if (!user.verified) return res.status(403).json({ error: 'Аккаунт не подтверждён. Проверьте почту.' });
  req.user = user;
  next();
}

function staffMiddleware(req, res, next) {
  if (!isStaffUser(req.user)) return res.status(403).json({ error: 'Нет доступа' });
  next();
}

function adminOnlyMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
  next();
}

/** @deprecated alias */
const adminMiddleware = staffMiddleware;

function getVpsServerByVmid(vmid) {
  const id = String(vmid);
  return db.prepare("SELECT * FROM servers WHERE id = ? AND type = 'vps'").get(id);
}

function createProvisionGrant(userId, externalId, serverType, tariffId) {
  const id = genId();
  db.prepare(`
    INSERT INTO provision_grants (id, user_id, external_id, server_type, tariff_id, used)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(user_id, external_id) DO UPDATE SET
      server_type = excluded.server_type,
      tariff_id = excluded.tariff_id,
      created_at = datetime('now'),
      used = 0
  `).run(id, userId, String(externalId), serverType, tariffId || null);
}

function consumeProvisionGrant(userId, externalId, tariffId) {
  const grant = db.prepare(`
    SELECT * FROM provision_grants
    WHERE user_id = ? AND external_id = ? AND used = 0
      AND datetime(created_at) > datetime('now', '-30 minutes')
  `).get(userId, String(externalId));
  if (!grant) return { ok: false, error: 'Сначала завершите оплату и создание сервера через покупку' };
  if (tariffId && grant.tariff_id && grant.tariff_id !== tariffId) {
    return { ok: false, error: 'Тариф не совпадает с оплаченным' };
  }
  db.prepare('UPDATE provision_grants SET used = 1 WHERE id = ?').run(grant.id);
  return { ok: true };
}

function requireVpsAccess(req, res) {
  const vmid = Number.parseInt(req.params.vmid, 10);
  if (!Number.isFinite(vmid) || vmid < 100) {
    res.status(400).json({ error: 'Некорректный ID VPS' });
    return null;
  }
  const server = getVpsServerByVmid(vmid);
  if (!server) {
    res.status(404).json({ error: 'VPS не найден' });
    return null;
  }
  if (!canAccessServer(server, req.user)) {
    res.status(403).json({ error: 'Нет доступа к этому VPS' });
    return null;
  }
  return { vmid, server };
}

// ══════════════════════════════════════════════════
// PROXMOX API CLASS
// ══════════════════════════════════════════════════
class ProxmoxAPI {
  constructor(config) { this.config = config; if (!config.host || !config.tokenId || !config.tokenSecret) console.error('[PROXMOX] Конфигурация неполная'); }
  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.config.host}/api2/json${endpoint}`;
    const headers = { 'Authorization': `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`, 'Content-Type': 'application/x-www-form-urlencoded' };
    const options = { method, headers, agent: this.config.verifySSL ? undefined : new https.Agent({ rejectUnauthorized: false }) };
    if (body && (method === 'POST' || method === 'PUT')) { const bodyString = new URLSearchParams(body).toString(); options.body = bodyString; console.log('[PROXMOX] Request URL:', url); console.log('[PROXMOX] Request body:', maskSensitiveData(bodyString)); }
    try {
      const response = await fetch(url, options);
      const responseText = await response.text();
      console.log('[PROXMOX] Response status:', response.status);
      console.log('[PROXMOX] Response body:', responseText);
      let data;
      try { data = JSON.parse(responseText); } catch { throw new Error(`Invalid JSON response: ${responseText}`); }
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      return data.data;
    } catch (error) {
      logError('PROXMOX', error.message, { endpoint, method, status: error.status, stack: error.stack });
      throw error;
    }
  }
  async getNextVMID() { return await this.request('/cluster/nextid'); }
  async getContainerStorage() { const storages = await this.request(`/nodes/${this.config.node}/storage`); const suitable = storages.find(s => s.content && s.content.includes('rootdir')); if (!suitable) throw new Error('Нет хранилища, поддерживающего контейнеры (rootdir)'); console.log(`[PROXMOX] Found container storage: ${suitable.storage}`); return suitable.storage; }
  async createLXC(params) {
    const { vmid, hostname, password, cores, memory, swap, storage, ostemplate, rootfs, net0 } = params;
    const payload = { vmid, hostname, password, cores: cores || 1, memory: memory || 512, swap: swap || 256, storage: storage, ostemplate: ostemplate || this.config.template, rootfs: rootfs || `${storage}:${Math.ceil(memory / 1024)}`, net0: net0 || 'name=eth0,bridge=vmbr0,ip=dhcp,type=veth', nameserver: '8.8.8.8' };
    Object.keys(payload).forEach(key => { if (payload[key] === undefined || payload[key] === null) delete payload[key]; });
    console.log('[PROXMOX] createLXC payload (cleaned):', JSON.stringify(maskSensitiveData(payload), null, 2));
    const endpoint = `/nodes/${this.config.node}/lxc`;
    const result = await this.request(endpoint, 'POST', payload);
    return { vmid, upid: result };
  }
  async getLXCStatus(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}/status/current`); }
  async getLXCInfo(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}/status/current`); }
  async getLXCInterfaces(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}/interfaces`); }
  async startLXC(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}/status/start`, 'POST'); }
  async stopLXC(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}/status/stop`, 'POST'); }
  async rebootLXC(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}/status/reboot`, 'POST'); }
  async deleteLXC(vmid) { return await this.request(`/nodes/${this.config.node}/lxc/${vmid}`, 'DELETE'); }
  async getUser(userid) { try { return await this.request(`/access/users/${encodeURIComponent(userid)}`); } catch (e) { return null; } }
  async createUser(userid, password, email, firstname, lastname) { const payload = { userid, password, email, firstname: firstname || '', lastname: lastname || '' }; console.log(`[PROXMOX] Creating user ${userid}`); return await this.request('/access/users', 'POST', payload); }
  async setUserACL(userid, path, role) { const payload = { path, roles: role, users: userid }; console.log(`[PROXMOX] Setting ACL: ${userid} on ${path} as ${role}`); return await this.request('/access/acl', 'PUT', payload); }
  async waitForTask(upid, timeout = 300000) {
    const startTime = Date.now();
    while ((Date.now() - startTime) < timeout) {
      const task = await this.request(`/nodes/${this.config.node}/tasks/${encodeURIComponent(upid)}/status`);
      if (task.status === 'stopped') { const exit = task.exitstatus || ''; if (exit === 'OK' || exit.startsWith('WARNINGS')) { return task; } throw new Error(`Task failed with exitstatus: ${exit}`); }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Task timeout');
  }
}
const proxmox = new ProxmoxAPI(PROXMOX_CONFIG);

// ══════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (полностью, без сокращений)
// ══════════════════════════════════════════════════
function formatPteroUserError(err, { refunded = false, stage = '', nodeId = null } = {}) {
  const msg = String(err?.message || 'Неизвестная ошибка');
  let userMessage = msg;
  const resolvedNodeId = nodeId ?? err?.nodeId ?? (Number(msg.match(/ноде (\d+)/)?.[1]) || null);

  if (msg.includes('Нет свободных аллокаций') || err?.code === 'no_allocations') {
    userMessage = getNoAllocationsUserMessage(resolvedNodeId || nodeId || 2);
  } else if (
    err?.status === 504
    || msg.includes('Could not establish a connection to the machine')
    || msg.includes('No healthy Wings')
    || msg.includes('DaemonConnectionException')
  ) {
    userMessage = 'Игровая нода недоступна: Wings не отвечает. Попробуйте позже или выберите другую локацию.';
  } else if (err?.status === 502 || err?.status === 503) {
    userMessage = 'Панель Pterodactyl временно недоступна. Попробуйте через несколько минут.';
  } else if (msg.includes('аутентификации') || msg.includes('Login to Continue')) {
    userMessage = 'Ошибка авторизации в Pterodactyl. Обратитесь в поддержку.';
  } else if (msg.includes('таймаут') || msg.includes('TimeoutError') || msg.includes('Task timeout')) {
    userMessage = 'Создание сервера заняло слишком много времени. Попробуйте позже.';
  } else if (msg.includes('Нет доступных яиц') || msg.includes('Не удалось определить яйцо')) {
    userMessage = 'Не удалось подобрать конфигурацию сервера. Обратитесь в поддержку.';
  } else if (msg.includes('Система VDS временно недоступна') || msg.includes('PROXMOX') || msg.includes('Task failed')) {
    userMessage = 'Система VDS временно недоступна. Попробуйте позже или обратитесь в поддержку.';
  } else if (msg.includes('Не выбран шаблон')) {
    userMessage = 'Не выбран шаблон операционной системы.';
  } else if (stage === 'payment') {
    userMessage = msg;
  }

  if (refunded) {
    userMessage += ' Средства возвращены на баланс.';
  }

  return userMessage;
}

async function pteroOnce(method, endpoint, body = null, timeoutMs = 30000) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${PTERO_ADMIN_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) opts.body = JSON.stringify(body);
  const url = `${PTERO_URL}/api/application${endpoint}`;
  console.log(`[PTERO] ${method} ${url}`);
  let res;
  try { res = await fetch(url, opts); } catch (e) {
    if (e.name === 'TimeoutError') {
      const err = new Error(`Pterodactyl не ответил за ${Math.round(timeoutMs / 1000)} секунд (таймаут)`);
      err.status = 504;
      throw err;
    }
    throw new Error(`Pterodactyl недоступен: ${e.message}`);
  }
  if (res.status === 204) return { success: true };
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    if (text.includes('Login to Continue') || text.includes('login')) throw new Error('Ошибка аутентификации Pterodactyl. Проверьте API-ключ.');
    throw new Error(`Некорректный ответ от Pterodactyl (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg = json.errors ? json.errors.map(e => e.detail || e.code).join('; ') : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    logError('PTERO', `${method} ${endpoint} failed: ${msg}`, {
      status: res.status,
      response: text.slice(0, 2000),
    });
    throw err;
  }
  return json;
}

async function ptero(method, endpoint, body = null, options = {}) {
  const {
    timeoutMs = 30000,
    retries = 0,
    retryDelayMs = 4000,
    retryOnStatus = [502, 503, 504],
  } = options;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pteroOnce(method, endpoint, body, timeoutMs);
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < retries && retryOnStatus.includes(err.status);
      if (canRetry) {
        console.warn(`[PTERO] ${method} ${endpoint} failed (${err.status || err.message}), retry ${attempt + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function isPteroDaemonError(err) {
  const msg = String(err?.message || '');
  return err?.status === 504
    || msg.includes('Could not establish a connection to the machine')
    || msg.includes('No healthy Wings')
    || msg.includes('DaemonConnectionException');
}

async function findPteroServerByUserAndName(pteroUserId, serverName) {
  try {
    const res = await ptero('GET', `/servers?filter[user]=${pteroUserId}&per_page=100`, null, { timeoutMs: 20000 });
    const match = (res.data || []).find(s => s.attributes?.name === serverName);
    return match?.attributes ?? null;
  } catch (err) {
    console.warn('[PTERO] findPteroServerByUserAndName failed:', err.message);
    return null;
  }
}

async function deletePteroServerSafe(serverId) {
  if (!serverId) return;
  try {
    await ptero('DELETE', `/servers/${serverId}/force`, null, { timeoutMs: 30000 });
    console.log(`[PTERO] Deleted server ${serverId}`);
  } catch (err) {
    try {
      await ptero('DELETE', `/servers/${serverId}`, null, { timeoutMs: 30000 });
      console.log(`[PTERO] Deleted server ${serverId} (soft)`);
    } catch (err2) {
      console.warn(`[PTERO] Failed to delete server ${serverId}:`, err2.message);
    }
  }
}

async function pickNodeAllocation(nodeId) {
  const nodeResponse = await ptero('GET', `/nodes/${nodeId}`, null, { timeoutMs: 20000 });
  const nodeData = nodeResponse.attributes;
  const freeAllocObj = await findFreeNodeAllocation(nodeId);
  if (!freeAllocObj) throw makeNoAllocationsError(nodeId);
  return {
    nodeId: Number(nodeId),
    nodeData,
    allocationId: freeAllocObj.attributes.id,
  };
}

async function createPteroGameServer({
  serverName,
  pteroUserId,
  preferredNodeId,
  serverPayload,
}) {
  const nodesToTry = [
    Number(preferredNodeId),
    ...PTERO_PURCHASE_NODE_IDS.filter(id => id !== Number(preferredNodeId)),
  ].filter(id => isAllowedPteroNode(id) && !isPteroNodeOverloaded(id));

  let lastErr;
  for (const nodeId of nodesToTry) {
    let allocationId;
    let nodeData;
    try {
      ({ allocationId, nodeData } = await pickNodeAllocation(nodeId));
      console.log(`[PROVISION] Creating server on node ${nodeId} (${nodeData.name}), allocation ${allocationId}`);
      const created = await ptero('POST', '/servers', {
        ...serverPayload,
        allocation: { default: allocationId },
        start_on_completion: false,
      }, { timeoutMs: 120000, retries: 1 });
      return { created, nodeId, nodeData, allocationId, recovered: false };
    } catch (err) {
      lastErr = err;
      const noAlloc = err?.code === 'no_allocations' || String(err?.message || '').includes('Нет свободных аллокаций');
      if (noAlloc) {
        if (nodesToTry.indexOf(nodeId) < nodesToTry.length - 1) {
          console.warn(`[PROVISION] Node ${nodeId} has no free allocations, trying next node...`);
          continue;
        }
        throw err;
      }
      if (!isPteroDaemonError(err)) throw err;

      const orphan = await findPteroServerByUserAndName(pteroUserId, serverName);
      if (orphan) {
        console.log(`[PROVISION] Recovered server ${orphan.id} after Wings error on node ${nodeId}`);
        const nodeResponse = await ptero('GET', `/nodes/${orphan.node}`, null, { timeoutMs: 20000 }).catch(() => null);
        return {
          created: { attributes: orphan },
          nodeId: orphan.node,
          nodeData: nodeResponse?.attributes ?? nodeData ?? null,
          allocationId: orphan.allocation,
          recovered: true,
        };
      }

      logError('PROVISION', `Wings unreachable on node ${nodeId}`, {
        nodeId,
        serverName,
        pteroUserId,
        message: err.message,
        status: err.status,
      });

      if (nodesToTry.indexOf(nodeId) < nodesToTry.length - 1) {
        console.warn(`[PROVISION] Node ${nodeId} Wings failed, trying next node...`);
        continue;
      }
    }
  }

  throw lastErr || new Error('Не удалось создать сервер на доступных нодах');
}

async function assertPteroNodeReachable(nodeId) {
  const id = Number(nodeId);
  if (!isAllowedPteroNode(id)) {
    throw Object.assign(new Error('Выберите локацию: Германия 1 или Германия 2'), { status: 400 });
  }
  await ptero('GET', `/nodes/${id}`, null, { timeoutMs: 20000 });
  const freeCount = await countFreeNodeAllocations(id);
  if (freeCount <= 0) throw makeNoAllocationsError(id);
  return id;
}

function genPassword(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

async function ensurePterodactylUser(email, username, providedPassword = null) {
  try {
    const existing = await ptero('GET', `/users?filter[email]=${encodeURIComponent(email)}`);
    if (existing.data?.length > 0) {
      const userId = existing.data[0].attributes.id;
      console.log(`[PTERO] Found existing user ${email} with id ${userId}`);
      if (providedPassword) { const encrypted = encryptPassword(providedPassword); db.prepare('UPDATE users SET encryptedPassword = ? WHERE email = ?').run(encrypted, email); }
      return { pteroUserId: userId, created: false };
    }
    const safeName = (username || 'user').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 28) || 'user';
    const password = providedPassword || genPassword();
    const newUser = await ptero('POST', '/users', { email, username: safeName + '_' + Math.floor(Math.random() * 10000), first_name: username || 'User', last_name: APP_NAME, password });
    const pteroUserId = newUser.attributes.id;
    console.log(`[PTERO] Created new user ${email} with id ${pteroUserId}`);
    const encrypted = encryptPassword(password);
    db.prepare('UPDATE users SET encryptedPassword = ? WHERE email = ?').run(encrypted, email);
    try { await sendPterodactylCredentials(email, safeName, password); } catch (emailErr) { console.error('[PTERO] Failed to send credentials email:', emailErr); }
    return { pteroUserId, created: true, password };
  } catch (error) { console.error('[PTERO] ensurePterodactylUser error:', error); return { pteroUserId: null, created: false, error: error.message }; }
}

async function sendMailTemplate(to, template) {
  if (!transporter || !to || !template) return;
  await transporter.sendMail({ from: smtpConfig.from, to, subject: template.subject, html: template.html });
}

async function sendPterodactylCredentials(email, _pteroUsername, pteroPassword) {
  const tpl = buildPterodactylCredentialsEmail(APP_NAME, email, pteroPassword, PTERO_URL);
  await sendMailTemplate(email, tpl);
}

async function sendVerificationEmail(email, code) {
  await sendMailTemplate(email, buildVerificationEmail(APP_NAME, code));
}

async function sendResetPasswordEmail(email, code) {
  await sendMailTemplate(email, buildResetPasswordEmail(APP_NAME, code));
}

function creditUserBalance({ userId, amount, operationId, providerLabel, providerKey }) {
  const amountCheck = parseMoneyAmount(amount, { min: 1, max: 100_000 });
  if (!amountCheck.ok) return { ok: false, error: amountCheck.error };
  const paid = amountCheck.value;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { ok: false, error: 'User not found' };

  const existing = db.prepare('SELECT id FROM transactions WHERE operation_id = ?').get(operationId);
  if (existing) return { ok: true, duplicate: true };

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(paid, userId);
  const transactionId = 'txn_' + genId();
  db.prepare('INSERT INTO transactions (id, userId, operation_id, amount) VALUES (?, ?, ?, ?)')
    .run(transactionId, userId, operationId, paid);

  sendDiscordLog({
    color: 0x2ecc71,
    title: `💰 Пополнение баланса (${providerLabel})`,
    fields: [
      { name: 'Пользователь', value: `${user.email} (${userId})`, inline: true },
      { name: 'Сумма', value: `${paid} ₽`, inline: true },
      { name: 'Провайдер', value: providerKey, inline: true },
      { name: 'Operation ID', value: operationId },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return { ok: true, amount: paid, user };
}

function formatServerPurchaseCost(server) {
  const monthly = Number(server?.price) || 0;
  const months = Number(server?.months) || 1;
  const total = monthly * months;
  if (total <= 0) return '0₽';
  if (months > 1) return `${total}₽ (${monthly}₽ × ${months} мес.)`;
  return `${total}₽`;
}

const PLATEGA_PAID_STATUSES = new Set([
  'CONFIRMED', 'SUCCESS', 'PAID', 'COMPLETED',
  'paid', 'confirmed', 'success',
]);

function normalizePlategaStatus(webhookData) {
  const raw = webhookData?.status
    ?? webhookData?.paymentStatus
    ?? webhookData?.state
    ?? webhookData?.transactionStatus
    ?? '';
  return String(raw).trim().toUpperCase();
}

function isPlategaPaidStatus(status) {
  if (!status) return false;
  return PLATEGA_PAID_STATUSES.has(status) || PLATEGA_PAID_STATUSES.has(status.toLowerCase());
}

function pickPlategaTransactionId(data) {
  if (!data || typeof data !== 'object') return null;
  return (
    data.id
    || data.transactionId
    || data.transaction_id
    || data.transaction?.id
    || data.transaction?.transactionId
    || data.data?.transactionId
    || data.data?.id
    || null
  );
}

function pickPlategaCallbackAmount(webhookData) {
  const raw = webhookData?.amount
    ?? webhookData?.paymentDetails?.amount
    ?? webhookData?.payment_details?.amount
    ?? null;
  if (raw === null || raw === undefined) return null;
  const check = parseMoneyAmount(raw, { min: 1, max: 100_000 });
  return check.ok ? check.value : null;
}

function verifyPlategaCallback(req) {
  const merchantId = process.env.PLATEGA_MERCHANT_ID;
  const secretKey = process.env.PLATEGA_SECRET_KEY;
  if (!merchantId || !secretKey) return true;
  const hdrMerchant = req.headers['x-merchantid'];
  const hdrSecret = req.headers['x-secret'];
  if (hdrMerchant && hdrMerchant !== merchantId) return false;
  if (hdrSecret && hdrSecret !== secretKey) return false;
  return true;
}

function resolvePlategaTempPayment(webhookData) {
  let orderId = null;
  let userId = null;
  if (webhookData?.payload) {
    try {
      const parsed = typeof webhookData.payload === 'string' ? JSON.parse(webhookData.payload) : webhookData.payload;
      orderId = parsed?.orderId || parsed?.order_id || null;
      userId = parsed?.userId || parsed?.user_id || null;
    } catch { /* ignore */ }
  }
  orderId = orderId || webhookData?.order_id || webhookData?.orderId || webhookData?.merchantOrderId || null;
  const gatewayRef = pickPlategaTransactionId(webhookData);

  if (orderId) {
    const byOrder = db.prepare('SELECT * FROM temp_payments WHERE order_id = ?').get(orderId);
    if (byOrder) return byOrder;
  }
  if (gatewayRef) {
    const ref = String(gatewayRef);
    const byGateway = db.prepare('SELECT * FROM temp_payments WHERE gateway_ref = ?').get(ref);
    if (byGateway) return byGateway;
    const byOrderPrefix = db.prepare('SELECT * FROM temp_payments WHERE order_id = ?').get(ref);
    if (byOrderPrefix) return byOrderPrefix;
  }
  if (userId) {
    const byUser = db.prepare(`
      SELECT * FROM temp_payments
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId);
    if (byUser) return byUser;
  }

  const callbackAmount = pickPlategaCallbackAmount(webhookData);
  if (callbackAmount !== null) {
    return db.prepare(`
      SELECT * FROM temp_payments
      WHERE status = 'pending' AND amount = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(callbackAmount);
  }

  return null;
}

function escapeHtmlText(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function notifyTicketOwnerOfStaffReply(ticket, content) {
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(ticket.userId);
  if (!owner) return;

  db.prepare('UPDATE tickets SET unread_for_user = 1, status = ? WHERE id = ?').run('answered', ticket.id);

  sendDiscordLog({
    color: 0x5865F2,
    title: '💬 Ответ сотрудника в тикете',
    fields: [
      { name: 'Тикет', value: ticket.subject, inline: true },
      { name: 'Клиент', value: owner.email, inline: true },
      { name: 'ID', value: ticket.id, inline: true },
      { name: 'Ответ', value: String(content).substring(0, 500) },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  const ticketsUrl = `${FRONTEND_URL}/dashboard/tickets`;
  try {
    const tpl = buildTicketReplyEmail(APP_NAME, {
      username: owner.username,
      subject: ticket.subject,
      excerpt: escapeHtmlText(content),
      ticketsUrl,
    });
    await sendMailTemplate(owner.email, tpl);
  } catch (e) {
    console.error('[EMAIL] Ticket reply notification failed:', e.message);
  }
}

const TICKET_STATUS_LABELS = {
  open: 'Открыт',
  answered: 'Отвечен',
  closed: 'Закрыт',
};

function ticketStatusLabel(status) {
  return TICKET_STATUS_LABELS[status] || String(status);
}

function notifyDiscordClientTicketReply(ticket, author, content) {
  sendDiscordLog({
    color: 0xe67e22,
    title: '💬 Новый ответ клиента в тикете',
    fields: [
      { name: 'Тикет', value: ticket.subject, inline: true },
      { name: 'Клиент', value: author.email || author.username, inline: true },
      { name: 'Категория', value: ticket.category || '—', inline: true },
      { name: 'ID', value: ticket.id, inline: true },
      { name: 'Сообщение', value: String(content).substring(0, 500) },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}

function notifyDiscordTicketStatusChange(ticket, actor, oldStatus, newStatus) {
  if (oldStatus === newStatus) return;
  sendDiscordLog({
    color: 0x9b59b6,
    title: '🔄 Статус тикета изменён',
    fields: [
      { name: 'Тикет', value: ticket.subject, inline: true },
      { name: 'Было', value: ticketStatusLabel(oldStatus), inline: true },
      { name: 'Стало', value: ticketStatusLabel(newStatus), inline: true },
      { name: 'Кем', value: `${actor.username} (${actor.email || '—'})`, inline: true },
      { name: 'ID', value: ticket.id, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}

async function verifyRecaptcha(token, timeoutMs = 8000) {
  if (!RECAPTCHA_ENABLED || !RECAPTCHA_SECRET_KEY) return { ok: true };
  if (!token) return { ok: false, reason: 'missing_token' };

  const verifyOnce = async () => {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json();
    if (!data.success) {
      return { ok: false, reason: 'invalid', codes: data['error-codes'] || [] };
    }
    return { ok: true };
  };

  try {
    return await verifyOnce();
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const isFetchFailed = err.name === 'TypeError' && String(err.message).includes('fetch failed');

    if (isTimeout) {
      logError('RECAPTCHA', 'Verification timeout, retrying once', { timeoutMs });
      try {
        return await verifyOnce();
      } catch (retryErr) {
        logError('RECAPTCHA', 'Verification timeout after retry', {
          timeoutMs,
          message: retryErr.message,
          cause: retryErr.cause ? String(retryErr.cause) : undefined,
        });
        return { ok: false, reason: 'timeout' };
      }
    }

    logError('RECAPTCHA', isFetchFailed ? 'Google API unreachable (fetch failed)' : 'Verification request failed', {
      message: err.message,
      name: err.name,
      cause: err.cause ? String(err.cause) : undefined,
      stack: err.stack,
    });
    return { ok: false, reason: 'network' };
  }
}

async function enforceRecaptcha(recaptchaToken, res) {
  if (!RECAPTCHA_ENABLED || !RECAPTCHA_SECRET_KEY) return true;

  const captcha = await verifyRecaptcha(recaptchaToken);
  if (captcha.ok) return true;

  const canFailOpen = RECAPTCHA_FAIL_OPEN_ON_NETWORK_ERROR
    && recaptchaToken
    && (captcha.reason === 'network' || captcha.reason === 'timeout');

  if (canFailOpen) {
    console.warn('[RECAPTCHA] Fail-open: Google unreachable, allowing request (rate limit still applies)');
    return true;
  }

  recaptchaErrorResponse(res, captcha);
  return false;
}

function recaptchaErrorResponse(res, result) {
  if (result.reason === 'timeout' || result.reason === 'network') {
    return res.status(503).json({
      error: 'Сервис проверки captcha временно недоступен. Подождите несколько секунд и попробуйте снова.',
      code: 'RECAPTCHA_UNAVAILABLE',
    });
  }
  return res.status(400).json({ error: 'Проверка reCAPTCHA не пройдена' });
}

async function updatePterodactylResources(serverId, ram, cores, disk) {
  const getUrl = `${PTERO_URL}/api/application/servers/${serverId}?include=allocations`;
  const getOpts = { method: 'GET', headers: { 'Authorization': `Bearer ${PTERO_ADMIN_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
  const getResponse = await fetch(getUrl, getOpts);
  if (!getResponse.ok) { const errorText = await getResponse.text(); throw new Error(`Failed to fetch server details: ${getResponse.status} ${errorText}`); }
  const serverData = await getResponse.json();
  const attributes = serverData.attributes;
  const allocationId = attributes.allocation?.id || attributes.allocation;
  if (!allocationId) throw new Error('Allocation ID not found');
  const featureLimits = attributes.feature_limits || { databases: 1, backups: 1 };
  const cpu = cores * 100;
  const buildUrl = `${PTERO_URL}/api/application/servers/${serverId}/build`;
  const buildBody = { allocation: allocationId, memory: ram, swap: 0, disk: disk, io: 500, cpu: cpu, feature_limits: featureLimits };
  console.log('[PTERO] Updating server build with:', buildBody);
  const buildOpts = { method: 'PATCH', headers: { 'Authorization': `Bearer ${PTERO_ADMIN_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(buildBody) };
  const buildResponse = await fetch(buildUrl, buildOpts);
  if (!buildResponse.ok) { const errorText = await buildResponse.text(); throw new Error(`Pterodactyl error (${buildResponse.status}): ${errorText}`); }
  return buildResponse.json();
}

// ══════════════════════════════════════════════════
// DISCORD OAUTH2 ROUTES
// ══════════════════════════════════════════════════
app.get('/api/auth/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('discord_oauth_state', state, { maxAge: 5 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });
  const authorizeUrl = `${DISCORD_API_ENDPOINT}/oauth2/authorize?` + new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: DISCORD_REDIRECT_URI, response_type: 'code', scope: 'identify email', state });
  res.redirect(authorizeUrl);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies?.discord_oauth_state;
  if (!state || state !== savedState) return res.status(400).send('Invalid state parameter');
  if (!code) return res.status(400).send('Missing code');
  try {
    const tokenResponse = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: DISCORD_REDIRECT_URI }) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || tokenData.error || 'Failed to get token');
    const userResponse = await fetch(`${DISCORD_API_ENDPOINT}/users/@me`, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const discordUser = await userResponse.json();
    if (!userResponse.ok) throw new Error(discordUser.message || 'Failed to get user info');
    const discordId = discordUser.id, email = discordUser.email, username = discordUser.username + '#' + discordUser.discriminator;
    let user = db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId);
    if (!user) {
      user = email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
      if (user) { db.prepare('UPDATE users SET discordId = ? WHERE id = ?').run(discordId, user.id); }
      else {
        const userId = genId(), randomPassword = crypto.randomBytes(20).toString('hex'), hashedPassword = await bcrypt.hash(randomPassword, 10);
        db.prepare(`INSERT INTO users (id, username, email, password, discordId, verified, role) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(userId, username, email || null, hashedPassword, discordId, 1, 'user');
        const encrypted = encryptPassword(randomPassword);
        db.prepare('UPDATE users SET encryptedPassword = ? WHERE id = ?').run(encrypted, userId);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        try { if (transporter && email) { await transporter.sendMail({ from: smtpConfig.from, to: email, subject: `Ваш пароль для ${APP_NAME} (Discord)`, html: `<p>Вы вошли через Discord. Ваш пароль для входа на сайт и в панели управления: <strong>${randomPassword}</strong></p><p>Рекомендуем сменить его в личном кабинете.</p>` }); } } catch (err) { console.error('[DISCORD] Failed to send password email:', err); }
      }
    }
    recordUserLoginIp(user.id, req);
    const banCheck = checkAccessBan(req, user);
    if (banCheck.banned) {
      return res.redirect(`${FRONTEND_URL}/auth/discord/error?message=${encodeURIComponent(banCheck.payload.error)}&code=${banCheck.payload.code}&reason=${encodeURIComponent(banCheck.payload.ban.reason)}&byIp=${banCheck.payload.ban.byIp ? '1' : '0'}`);
    }
    const sessionToken = genId() + genId();
    db.prepare('INSERT INTO sessions (token, userId) VALUES (?,?)').run(sessionToken, user.id);
    sendDiscordLog({ color: 0x5865F2, title: '🔑 Вход через Discord', fields: [{ name: 'Пользователь', value: `${user.username} (${user.email || 'email скрыт'})`, inline: true }, { name: 'Discord ID', value: discordId, inline: true }], timestamp: new Date().toISOString() }).catch(() => {});
    res.redirect(`${FRONTEND_URL}/auth/discord/success?token=${sessionToken}`);
  } catch (error) {
    console.error('[DISCORD OAUTH] Error:', error);
    sendDiscordLog({ color: 0xff0000, title: '❌ Ошибка входа через Discord', fields: [{ name: 'Ошибка', value: error.message }], timestamp: new Date().toISOString() }).catch(() => {});
    res.redirect(`${FRONTEND_URL}/auth/discord/error?message=${encodeURIComponent(error.message)}`);
  }
});

// Глобальные обработчики ошибок
process.on('unhandledRejection', (reason, promise) => {
  logError('UNHANDLED_REJECTION', String(reason), { promise: String(promise) });
  sendDiscordLog({ color: 0xff0000, title: '⚠️ Необработанная ошибка (unhandledRejection)', fields: [{ name: 'Ошибка', value: String(reason).substring(0, 1000) }], timestamp: new Date().toISOString() }).catch(() => {});
});
process.on('uncaughtException', (err) => {
  logError('UNCAUGHT_EXCEPTION', err.message, { stack: err.stack });
  sendDiscordLog({ color: 0xff0000, title: '💥 Непойманное исключение (uncaughtException)', fields: [{ name: 'Ошибка', value: err.stack ? err.stack.substring(0, 1000) : err.message }], timestamp: new Date().toISOString() }).catch(() => {});
});
// ══════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password, recaptchaToken, ref } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (!validator.isEmail(email)) return res.status(400).json({ error: 'Некорректный email' });
  const usernameRegex = /^[a-zA-Zа-яА-ЯёЁ0-9_.#-]{3,30}$/;
  if (!usernameRegex.test(username)) return res.status(400).json({ error: 'Имя пользователя должно быть 3-30 символов и может содержать буквы, цифры, _, ., -, #' });
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  if (!passwordRegex.test(password)) return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов, включая буквы и цифры' });
  if (RECAPTCHA_ENABLED && RECAPTCHA_SECRET_KEY) {
    if (!(await enforceRecaptcha(recaptchaToken, res))) return;
  }

  const ipBanCheck = checkAccessBan(req);
  if (ipBanCheck.banned) return res.status(ipBanCheck.status).json(ipBanCheck.payload);

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email.toLowerCase(), username);
  if (existing) return res.status(400).json({ error: 'Пользователь уже существует' });

  const id = genId();
  const hashedPassword = await bcrypt.hash(password, 10);

  let referredBy = null;
  if (ref) {
    const referrer = db.prepare('SELECT id FROM users WHERE id = ?').get(String(ref).trim());
    if (referrer && referrer.id !== id) referredBy = referrer.id;
  }

  db.prepare('INSERT INTO users (id, username, email, password, verified, referred_by) VALUES (?,?,?,?,?,?)')
    .run(id, username, email.toLowerCase(), hashedPassword, 0, referredBy);

  // Сразу шифруем и сохраняем пароль
  const encrypted = encryptPassword(password);
  db.prepare('UPDATE users SET encryptedPassword = ? WHERE id = ?').run(encrypted, id);

  let pteroUserId = null;
  try {
    // Передаём пароль, чтобы создать учётку Pterodactyl с тем же паролем
    const result = await ensurePterodactylUser(email.toLowerCase(), username, password);
    if (result.pteroUserId) {
      pteroUserId = result.pteroUserId;
      db.prepare('UPDATE users SET pterodactylUserId = ? WHERE id = ?').run(pteroUserId, id);
    }
  } catch (pteroError) {
    console.error('[REGISTER] Failed to create Pterodactyl user:', pteroError);
  }

  const code = genCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO verification_codes (id, userId, code, type, expiresAt) VALUES (?,?,?,?,?)')
    .run(genId(), id, code, 'verify', expiresAt);

  try { await sendVerificationEmail(email, code); } catch (e) { console.error('[EMAIL] Failed to send verification code:', e); }

  sendDiscordLog({
    color: 0x00ff00,
    title: '🎉 Новая регистрация',
    fields: [
      { name: 'Пользователь', value: `${username} (${email})`, inline: true },
      { name: 'ID', value: id, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  res.json({ success: true, message: 'Регистрация успешна. Проверьте почту для подтверждения.' });
});

app.post('/api/auth/verify', authLimiter, (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Заполните все поля' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.verified) return res.status(400).json({ error: 'Аккаунт уже подтверждён' });
  const verification = db.prepare('SELECT * FROM verification_codes WHERE userId = ? AND code = ? AND type = ? AND used = 0 AND expiresAt > datetime(\'now\')')
    .get(user.id, code, 'verify');
  if (!verification) return res.status(400).json({ error: 'Неверный или истёкший код' });
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(verification.id);
  db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);
  res.json({ success: true, message: 'Email подтверждён. Теперь вы можете войти.' });
});

app.post('/api/auth/forgot', authLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Введите email' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'Пользователь с таким email не найден' });
  const code = genCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO verification_codes (id, userId, code, type, expiresAt) VALUES (?,?,?,?,?)')
    .run(genId(), user.id, code, 'reset', expiresAt);
  sendResetPasswordEmail(email, code).catch(e => console.error('[EMAIL] Failed to send reset code:', e));
  res.json({ success: true, message: 'Код для сброса пароля отправлен на почту.' });
});

app.post('/api/auth/reset', authLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов, включая буквы и цифры' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const verification = db.prepare('SELECT * FROM verification_codes WHERE userId = ? AND code = ? AND type = ? AND used = 0 AND expiresAt > datetime(\'now\')')
    .get(user.id, code, 'reset');
  if (!verification) return res.status(400).json({ error: 'Неверный или истёкший код' });
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(verification.id);
  res.json({ success: true, message: 'Пароль успешно изменён. Теперь вы можете войти.' });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Заполните все поля' });

    if (RECAPTCHA_ENABLED && RECAPTCHA_SECRET_KEY) {
      if (!(await enforceRecaptcha(recaptchaToken, res))) return;
    }

    const ipBanCheck = checkAccessBan(req);
    if (ipBanCheck.banned) return res.status(ipBanCheck.status).json(ipBanCheck.payload);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(400).json({ error: 'Неверная почта или пароль' });

    const banCheck = checkAccessBan(req, user);
    if (banCheck.banned) return res.status(banCheck.status).json(banCheck.payload);

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Неверная почта или пароль' });
    if (!user.verified) return res.status(403).json({ error: 'Аккаунт не подтверждён. Проверьте почту.' });

    recordUserLoginIp(user.id, req);

    if (user.twoFactorEnabled) {
      const tempToken = genId() + genId();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO temp_tokens (token, userId, expiresAt) VALUES (?,?,?)').run(tempToken, user.id, expiresAt);
      return res.json({ require2FA: true, tempToken });
    }

    const token = genId() + genId();
    db.prepare('INSERT INTO sessions (token, userId) VALUES (?,?)').run(token, user.id);

    sendDiscordLog({
      color: 0x3498db,
      title: '🔑 Вход в аккаунт',
      fields: [
        { name: 'Пользователь', value: user.email, inline: true },
        { name: 'ID', value: user.id, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    logError('AUTH_LOGIN', err.message, { stack: err.stack, email: req.body?.email });
    res.status(500).json({ error: 'Ошибка входа. Попробуйте ещё раз через несколько секунд.' });
  }
});

app.post('/api/auth/2fa/verify-login', authLimiter, (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'Заполните все поля' });
  const temp = db.prepare('SELECT * FROM temp_tokens WHERE token = ? AND expiresAt > datetime(\'now\')').get(tempToken);
  if (!temp) return res.status(400).json({ error: 'Временный токен истёк или недействителен' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(temp.userId);
  if (!user || !user.twoFactorEnabled) return res.status(400).json({ error: '2FA не включена' });
  const banCheck = checkAccessBan(req, user);
  if (banCheck.banned) return res.status(banCheck.status).json(banCheck.payload);
  const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code });
  if (!verified) return res.status(400).json({ error: 'Неверный код' });
  db.prepare('DELETE FROM temp_tokens WHERE token = ?').run(tempToken);
  recordUserLoginIp(user.id, req);
  const token = genId() + genId();
  db.prepare('INSERT INTO sessions (token, userId) VALUES (?,?)').run(token, user.id);

  sendDiscordLog({
    color: 0x3498db,
    title: '🔑 Вход в аккаунт (2FA)',
    fields: [
      { name: 'Пользователь', value: user.email, inline: true },
      { name: 'ID', value: user.id, inline: true },
    ],
  }).catch(() => {});

  res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/2fa/status', authMiddleware, (req, res) => {
  res.json({ enabled: !!req.user.twoFactorEnabled });
});

app.post('/api/auth/2fa/enable', authMiddleware, (req, res) => {
  if (req.user.twoFactorEnabled) return res.status(400).json({ error: '2FA уже включена' });
  const secret = speakeasy.generateSecret({ length: 20 });
  const otpauth = `otpauth://totp/${APP_NAME}:${encodeURIComponent(req.user.email)}?secret=${secret.base32}&issuer=${APP_NAME}`;
  db.prepare('UPDATE users SET twoFactorSecret = ? WHERE id = ?').run(secret.base32, req.user.id);
  res.json({ secret: secret.base32, otpauth_url: otpauth });
});

app.post('/api/auth/2fa/verify', authMiddleware, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Введите код' });
  const secret = req.user.twoFactorSecret;
  if (!secret) return res.status(400).json({ error: 'Секрет не найден. Сначала запросите enable.' });
  const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token });
  if (!verified) return res.status(400).json({ error: 'Неверный код' });
  db.prepare('UPDATE users SET twoFactorEnabled = 1 WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

app.post('/api/auth/2fa/disable', authMiddleware, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Введите пароль' });
  const match = await bcrypt.compare(password, req.user.password);
  if (!match) return res.status(400).json({ error: 'Неверный пароль' });
  db.prepare('UPDATE users SET twoFactorSecret = NULL, twoFactorEnabled = 0 WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════
// PTERODACTYL CREDENTIALS ENDPOINT (расшифровка)
// ══════════════════════════════════════════════════
app.get('/api/auth/ptero-credentials', authMiddleware, (req, res) => {
  if (!req.user.pterodactylUserId) return res.status(404).json({ error: 'Нет привязанного Pterodactyl-аккаунта' });
  const decryptedPassword = req.user.encryptedPassword ? decryptPassword(req.user.encryptedPassword) : null;
  res.json({ login: req.user.email, password: decryptedPassword });
});

function sanitizeUser(u) {
  return {
    id: u.id, username: u.username, email: u.email,
    balance: u.balance, role: u.role, blocked: !!u.blocked,
    isAdmin: u.role === 'admin', createdAt: u.createdAt,
    pterodactylUserId: u.pterodactylUserId,
    verified: !!u.verified,
    twoFactorEnabled: !!u.twoFactorEnabled,
    discordId: u.discordId,
  };
}

function sanitizeAdminUser(u) {
  return {
    ...sanitizeUser(u),
    banReason: u.ban_reason || null,
    banByIp: !!u.ban_by_ip,
    lastLoginIp: u.last_login_ip || null,
  };
}

// ══════════════════════════════════════════════════
// USER PROFILE
// ══════════════════════════════════════════════════
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { username, email } = req.body;
  if (username !== undefined) {
    const nameCheck = validateUsername(username);
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
    const dup = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(nameCheck.value, req.user.id);
    if (dup) return res.status(400).json({ error: 'Имя занято' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(nameCheck.value, req.user.id);
  }
  if (email !== undefined) {
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });
    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(emailCheck.value, req.user.id);
    if (dup) return res.status(400).json({ error: 'Почта занята' });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(emailCheck.value, req.user.id);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: sanitizeUser(user) });
});

app.put('/api/auth/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const match = await bcrypt.compare(currentPassword, req.user.password);
  if (!match) return res.status(400).json({ error: 'Неверный текущий пароль' });
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов, включая буквы и цифры' });
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
  // Обновляем зашифрованную копию
  const encrypted = encryptPassword(newPassword);
  db.prepare('UPDATE users SET encryptedPassword = ? WHERE id = ?').run(encrypted, req.user.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════
// PLANS (с защитой от отрицательной цены)
// ══════════════════════════════════════════════════
function mapPlanRow(p) {
  return {
    ...p,
    features: JSON.parse(p.features || '[]'),
    popular: !!p.popular,
    type: p.type || 'game',
    once_per_account: !!p.once_per_account,
    node_id: p.node_id ?? null,
  };
}

function isPlanRowValid(p) {
  return validatePlanRecord(p).ok;
}

app.get('/api/plans', (_req, res) => {
  const plans = db.prepare('SELECT * FROM plans ORDER BY sortOrder ASC, price ASC').all();
  res.json(plans.filter(isPlanRowValid).map(mapPlanRow));
});

app.post('/api/plans', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const { features, popular, icon, description, once_per_account } = req.body;
  const validated = validatePlanPayload(req.body);
  if (!validated.ok) return res.status(400).json({ error: validated.error });
  const { name, tier, price, ram, cores, disk, type, node_id } = validated.value;
  const id = 'plan_' + genId();
  const maxOrder = db.prepare('SELECT MAX(sortOrder) as m FROM plans').get();
  const safeFeatures = Array.isArray(features)
    ? features.map(f => String(f).slice(0, 200)).filter(Boolean).slice(0, 30)
    : [];
  db.prepare('INSERT INTO plans (id,name,tier,type,price,ram,cores,disk,features,popular,icon,description,sortOrder,once_per_account,node_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, name, tier, type || 'game', price, ram, cores, disk, JSON.stringify(safeFeatures), popular ? 1 : 0, icon || 'fa-cube', String(description || '').slice(0, 500), (maxOrder?.m || 0) + 1, once_per_account ? 1 : 0, node_id ?? null
  );
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  res.json(mapPlanRow(plan));
});

app.put('/api/plans/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Тариф не найден' });
  const validated = validatePlanPayload(req.body, { partial: false });
  if (!validated.ok) return res.status(400).json({ error: validated.error });
  const { name, tier, price, ram, cores, disk, type, node_id } = validated.value;
  const { features, popular, icon, description, once_per_account } = req.body;
  const safeFeatures = Array.isArray(features)
    ? features.map(f => String(f).slice(0, 200)).filter(Boolean).slice(0, 30)
    : JSON.parse(existing.features || '[]');
  db.prepare('UPDATE plans SET name=?,tier=?,type=?,price=?,ram=?,cores=?,disk=?,features=?,popular=?,icon=?,description=?,once_per_account=?,node_id=? WHERE id=?').run(
    name, tier, type || 'game', price, ram, cores, disk, JSON.stringify(safeFeatures), popular ? 1 : 0, icon || 'fa-cube', String(description || '').slice(0, 500), once_per_account ? 1 : 0, node_id ?? null, req.params.id
  );
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  res.json(mapPlanRow(plan));
});

app.delete('/api/plans/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
// ══════════════════════════════════════════════════
// SERVERS (с os_template и проверкой node_id, без списания баланса)
// ══════════════════════════════════════════════════
app.get('/api/servers', authMiddleware, (req, res) => {
  let servers;
  if (req.user.role === 'admin') {
    servers = db.prepare('SELECT * FROM servers ORDER BY createdAt DESC').all();
  } else {
    servers = db.prepare('SELECT * FROM servers WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
  }
  res.json(servers);
});

app.get('/api/servers/:id', authMiddleware, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  if (!canAccessServer(server, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  res.json(server);
});

app.post('/api/servers', authMiddleware, (req, res) => {
  try {
    let { name, tariffId, tariffName, tariffTier, coreName, ram, cores, disk, price, months, expiresAt, ip, port, node, pterodactylServerId, pterodactylIdentifier, pterodactylUuid, type, os_template } = req.body;
    const serverType = type || 'game';

    const nameCheck = validateServerName(name);
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
    name = nameCheck.value;

    if (req.user.role !== 'admin') {
      const externalId = pterodactylServerId || pterodactylIdentifier;
      if (!externalId) {
        return res.status(400).json({ error: 'Сервер можно добавить только после успешной покупки' });
      }
      const dup = db.prepare('SELECT id FROM servers WHERE pterodactylServerId = ? OR id = ?').get(String(externalId), String(externalId));
      if (dup) return res.status(409).json({ error: 'Сервер уже зарегистрирован' });
      const grantCheck = consumeProvisionGrant(req.user.id, externalId, tariffId);
      if (!grantCheck.ok) return res.status(403).json({ error: grantCheck.error });
      if (!tariffId) return res.status(400).json({ error: 'Не указан тариф' });
      const tariff = db.prepare('SELECT * FROM plans WHERE id = ?').get(tariffId);
      if (!tariff) return res.status(400).json({ error: 'Тариф не найден' });
      const tariffSpecs = validatePlanRecord(tariff);
      if (!tariffSpecs.ok) return res.status(400).json({ error: 'Тариф недоступен' });
      if (tariff.node_id !== null && tariff.node_id !== node) {
        return res.status(400).json({ error: `Этот тариф можно создать только на ноде ${tariff.node_id}` });
      }
      ram = tariff.ram;
      cores = tariff.cores;
      disk = tariff.disk;
      price = tariff.price;
      tariffName = tariff.name;
      tariffTier = tariff.tier;
      const monthsCheck = parseRenewMonths(months ?? 1);
      if (!monthsCheck.ok) return res.status(400).json({ error: monthsCheck.error });
      months = monthsCheck.value;
    } else {
      const specs = validatePlanPayload({ name: tariffName || 'Admin', tier: tariffTier || 'Custom', price: price ?? 0, ram, cores, disk });
      if (!specs.ok) return res.status(400).json({ error: specs.error });
      ram = specs.value.ram;
      cores = specs.value.cores;
      disk = specs.value.disk;
      price = specs.value.price;
    }

    const id = serverType === 'vps' && pterodactylServerId
      ? String(pterodactylServerId)
      : genId();
    db.prepare(`INSERT INTO servers (id,userId,name,tariffId,tariffName,tariffTier,type,coreName,status,ram,cores,disk,price,months,expiresAt,ip,port,node,pterodactylServerId,pterodactylIdentifier,pterodactylUuid,os_template) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, req.user.id, name, tariffId, tariffName, tariffTier, serverType, coreName, 'active', ram, cores, disk, price, months, expiresAt,
      ip || null, port || null, node || null, pterodactylServerId || null, pterodactylIdentifier || null, pterodactylUuid || null,
      os_template || null
    );
    
    if (tariffId) {
      const tariff = db.prepare('SELECT once_per_account FROM plans WHERE id = ?').get(tariffId);
      if (tariff && tariff.once_per_account === 1) {
        db.prepare('INSERT OR IGNORE INTO once_purchases (id, user_id, tariff_id) VALUES (?, ?, ?)').run(genId(), req.user.id, tariffId);
      }
    }
    
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    sendDiscordLog({
      color: 0x2ecc71,
      title: '🖥️ Создан сервер',
      fields: [
        { name: 'Пользователь', value: req.user.email, inline: true },
        { name: 'Сервер', value: server.name, inline: true },
        { name: 'Тип', value: server.type, inline: true },
        { name: 'Тариф', value: `${server.tariffTier} ${server.tariffName}`, inline: true },
        { name: 'Стоимость', value: formatServerPurchaseCost(server), inline: true },
        { name: 'ID в БД', value: server.id, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    res.json({ server, user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('[POST /api/servers] Error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.put('/api/servers/:id', authMiddleware, (req, res) => {
  try {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'Сервер не найден' });
    if (!canAccessServer(server, req.user)) return res.status(403).json({ error: 'Нет доступа' });
    const isAdmin = req.user.role === 'admin';
    const allowedFields = isAdmin
      ? [
          'name', 'tariffId', 'tariffName', 'tariffTier', 'coreName',
          'ram', 'cores', 'disk', 'price', 'status', 'expiresAt',
          'ip', 'port', 'node', 'pterodactylServerId', 'pterodactylIdentifier',
          'pterodactylUuid', 'autoRenew', 'type', 'os_template',
        ]
      : ['name', 'coreName', 'autoRenew', 'os_template'];
    const updates = [];
    const values = [];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (field === 'name') {
          const nameCheck = validateServerName(value);
          if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
          value = nameCheck.value;
        }
        if (field === 'autoRenew' && typeof value === 'boolean') value = value ? 1 : 0;
        updates.push(`${field} = ?`);
        values.push(value);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    values.push(req.params.id);
    const query = `UPDATE servers SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);
    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (updated && updated.autoRenew !== undefined) updated.autoRenew = !!updated.autoRenew;
    res.json(updated);
  } catch (error) {
    console.error('[PUT /api/servers/:id] Error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.delete('/api/servers/:id', authMiddleware, async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  if (!canAccessServer(server, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  if (req.user.role !== 'admin' && server.userId !== req.user.id) {
    return res.status(403).json({ error: 'Удаление чужих серверов запрещено' });
  }
  if (server.pterodactylServerId) {
    try {
      await ptero('DELETE', `/servers/${server.pterodactylServerId}/force`).catch(async () => {
        await ptero('DELETE', `/servers/${server.pterodactylServerId}`);
      });
    } catch (pteroError) {
      console.error('[PTERO] Failed to delete server, but will delete from DB:', pteroError.message);
    }
  }
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);

  sendDiscordLog({
    color: 0xe74c3c,
    title: '🗑️ Сервер удалён',
    fields: [
      { name: 'Сервер', value: server.name, inline: true },
      { name: 'Тип', value: server.type, inline: true },
      { name: 'Пользователь', value: req.user.email, inline: true },
      { name: 'Администратор?', value: req.user.role === 'admin' ? 'Да' : 'Нет', inline: true },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  res.json({ success: true });
});

app.post('/api/servers/:id/renew', authMiddleware, sensitiveApiLimiter, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  if (!canAccessServer(server, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  const monthsCheck = parseRenewMonths(req.body.months);
  if (!monthsCheck.ok) return res.status(400).json({ error: monthsCheck.error });
  const months = monthsCheck.value;
  const unitPrice = Number(server.price);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'Некорректная цена сервера' });
  const cost = calcRenewalCost(unitPrice, months);
  if (cost <= 0 && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'Некорректная стоимость продления' });
  }
  if (req.user.role !== 'admin') {
    if (req.user.balance < cost) return res.status(400).json({ error: 'Недостаточно средств' });
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(cost, req.user.id);
  }
  const exp = new Date(Math.max(new Date(server.expiresAt).getTime(), Date.now()));
  exp.setMonth(exp.getMonth() + months);
  db.prepare('UPDATE servers SET expiresAt = ?, status = ? WHERE id = ?').run(exp.toISOString(), 'active', req.params.id);
  const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ server: updated, user: sanitizeUser(user) });
});

app.post('/api/servers/:id/change-tariff', authMiddleware, async (req, res) => {
  try {
    const { tariffId } = req.body;
    if (!tariffId) return res.status(400).json({ error: 'Не указан тариф' });
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) return res.status(404).json({ error: 'Сервер не найден' });
    if (!canAccessServer(server, req.user)) return res.status(403).json({ error: 'Нет доступа' });
    const oldTariffPrice = server.price;
    const newTariff = db.prepare('SELECT * FROM plans WHERE id = ?').get(tariffId);
    if (!newTariff) return res.status(404).json({ error: 'Тариф не найден' });
    const newTariffSpecs = validatePlanRecord(newTariff);
    if (!newTariffSpecs.ok) return res.status(400).json({ error: 'Тариф недоступен' });
    if (newTariff.node_id !== null && newTariff.node_id !== server.node) {
      return res.status(400).json({ error: `Этот тариф можно использовать только на ноде ${newTariff.node_id}` });
    }
    
    if (req.user.role !== 'admin') {
      if (newTariff.once_per_account === 1) {
        const alreadyPurchased = db.prepare('SELECT id FROM once_purchases WHERE user_id = ? AND tariff_id = ?').get(req.user.id, tariffId);
        if (alreadyPurchased) return res.status(400).json({ error: 'Этот тариф можно приобрести только один раз на аккаунт.' });
      }
    }
    
    const now = Date.now();
    const expires = new Date(server.expiresAt).getTime();
    const daysLeft = Math.max(0, Math.ceil((expires - now) / 86400000));
    const monthDays = 30;
    const oldPricePerDay = oldTariffPrice / monthDays;
    const newPricePerDay = newTariff.price / monthDays;
    const costDiff = (newPricePerDay - oldPricePerDay) * daysLeft;
    if (req.user.role !== 'admin') {
      const userBalance = req.user.balance;
      if (costDiff > 0 && userBalance < costDiff) return res.status(400).json({ error: 'Недостаточно средств для смены тарифа' });
    }
    if (server.pterodactylServerId) {
      try {
        await updatePterodactylResources(server.pterodactylServerId, newTariff.ram, newTariff.cores, newTariff.disk);
      } catch (pteroError) {
        console.error('[PTERO] Failed to update server resources:', pteroError);
        return res.status(500).json({ error: 'Не удалось обновить ресурсы в Pterodactyl: ' + pteroError.message });
      }
    }
    if (req.user.role !== 'admin' && costDiff > 0.01) {
      const newBalance = req.user.balance - costDiff;
      db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, req.user.id);
      req.user.balance = newBalance;
    }
    db.prepare(`
      UPDATE servers SET
        tariffId = ?,
        tariffName = ?,
        tariffTier = ?,
        ram = ?,
        cores = ?,
        disk = ?,
        price = ?
      WHERE id = ?
    `).run(
      newTariff.id,
      newTariff.name,
      newTariff.tier,
      newTariff.ram,
      newTariff.cores,
      newTariff.disk,
      newTariff.price,
      server.id
    );
    
    if (req.user.role !== 'admin' && newTariff.once_per_account === 1) {
      db.prepare('INSERT OR IGNORE INTO once_purchases (id, user_id, tariff_id) VALUES (?, ?, ?)').run(genId(), req.user.id, tariffId);
    }
    
    const updatedServer = db.prepare('SELECT * FROM servers WHERE id = ?').get(server.id);
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ server: updatedServer, user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('[POST /api/servers/:id/change-tariff] Error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════
// TICKETS (с cooldown и админским удалением) + логирование
// ══════════════════════════════════════════════════
app.post('/api/tickets/upload-image', authMiddleware, (req, res) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Нет изображения' });
    }
    const match = image.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Неверный формат изображения' });
    }
    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Файл больше 5 МБ' });
    }
    const name = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(join(TICKET_UPLOAD_DIR, name), buf);
    res.json({ url: `/uploads/tickets/${name}` });
  } catch (e) {
    console.error('[TICKET UPLOAD]', e);
    res.status(500).json({ error: 'Не удалось сохранить изображение' });
  }
});

app.get('/api/tickets', authMiddleware, (req, res) => {
  let tickets;
  if (req.user.role === 'admin' || req.user.role === 'support') {
    tickets = db.prepare('SELECT * FROM tickets ORDER BY createdAt DESC').all();
  } else {
    tickets = db.prepare('SELECT * FROM tickets WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
  }
  const getMessages = db.prepare('SELECT * FROM ticket_messages WHERE ticketId = ? ORDER BY createdAt ASC');
  tickets = tickets.map(t => ({ ...t, messages: getMessages.all(t.id).map(m => ({ ...m, isStaff: !!m.isStaff })) }));
  res.json(tickets);
});

app.post('/api/tickets', authMiddleware, (req, res) => {
  const { category } = req.body;
  const subjectCheck = validateTicketSubject(req.body.subject);
  if (!subjectCheck.ok) return res.status(400).json({ error: subjectCheck.error });
  const message = sanitizeTicketText(req.body.message);
  if (!message) return res.status(400).json({ error: 'Заполните сообщение' });
  const subject = subjectCheck.value;

  const now = Date.now();
  const lastTicket = req.user.lastTicketAt ? new Date(req.user.lastTicketAt).getTime() : 0;
  const diff = now - lastTicket;
  const cooldownMs = 15 * 60 * 1000;
  if (diff < cooldownMs) {
    const remainingMs = cooldownMs - diff;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return res.status(429).json({ error: `Вы можете создать новый тикет через ${remainingMinutes} мин.` });
  }

  const ticketId = genId();
  const msgId = genId();
  db.prepare('INSERT INTO tickets (id, userId, username, subject, category) VALUES (?,?,?,?,?)').run(
    ticketId, req.user.id, req.user.username, subject, category || 'Другое'
  );
  db.prepare('INSERT INTO ticket_messages (id, ticketId, authorId, authorName, isStaff, content) VALUES (?,?,?,?,?,?)').run(
    msgId, ticketId, req.user.id, req.user.username, 0, message
  );

  const autoReplyId = genId();
  db.prepare('INSERT INTO ticket_messages (id, ticketId, authorId, authorName, isStaff, content) VALUES (?,?,?,?,?,?)').run(
    autoReplyId,
    ticketId,
    TICKET_AUTO_REPLY_AUTHOR_ID,
    `${APP_NAME} · Поддержка`,
    1,
    buildTicketAutoReplyMessage(ticketId, APP_NAME),
  );

  db.prepare('UPDATE users SET lastTicketAt = ? WHERE id = ?').run(new Date().toISOString(), req.user.id);

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticketId = ?').all(ticketId);

  sendDiscordLog({
    color: 0xe67e22,
    title: '🎫 Новый тикет',
    fields: [
      { name: 'Пользователь', value: req.user.email, inline: true },
      { name: 'Тема', value: subject, inline: true },
      { name: 'Категория', value: category || 'Другое', inline: true },
      { name: 'Сообщение', value: message.substring(0, 200) },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  res.json({ ...ticket, messages: messages.map(m => ({ ...m, isStaff: !!m.isStaff })) });
});

app.post('/api/tickets/:id/messages', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
  if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ error: 'Нет доступа к тикету' });
  if (ticket.status === 'closed' && !isStaffUser(req.user)) {
    return res.status(400).json({ error: 'Тикет закрыт' });
  }
  const content = sanitizeTicketText(req.body.content);
  if (!content) return res.status(400).json({ error: 'Введите сообщение' });
  const isStaff = isStaffUser(req.user);
  const oldStatus = ticket.status;
  db.prepare('INSERT INTO ticket_messages (id, ticketId, authorId, authorName, isStaff, content) VALUES (?,?,?,?,?,?)').run(
    genId(), req.params.id, req.user.id, req.user.username, isStaff ? 1 : 0, content
  );
  if (isStaff && ticket.userId !== req.user.id) {
    notifyTicketOwnerOfStaffReply(ticket, content).catch(e => console.error('[TICKET] notify error:', e));
    if (oldStatus !== 'answered') {
      notifyDiscordTicketStatusChange(ticket, req.user, oldStatus, 'answered');
    }
  } else {
    const newStatus = isStaff ? 'answered' : 'open';
    db.prepare('UPDATE tickets SET status = ?, unread_for_user = 0 WHERE id = ?').run(newStatus, req.params.id);
    if (!isStaff) {
      notifyDiscordClientTicketReply(ticket, req.user, content);
    }
    if (oldStatus !== newStatus) {
      notifyDiscordTicketStatusChange(ticket, req.user, oldStatus, newStatus);
    }
  }
  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticketId = ?').all(req.params.id);
  res.json({ ...updated, messages: messages.map(m => ({ ...m, isStaff: !!m.isStaff })) });
});

app.post('/api/tickets/:id/mark-read', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
  if (ticket.userId !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
  db.prepare('UPDATE tickets SET unread_for_user = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/notifications', authMiddleware, (req, res) => {
  const ticketReplies = db.prepare(`
    SELECT id, subject, category, status, createdAt
    FROM tickets
    WHERE userId = ? AND unread_for_user = 1 AND status = 'answered'
    ORDER BY createdAt DESC
    LIMIT 20
  `).all(req.user.id);
  res.json({ ticketReplies, unreadTickets: ticketReplies.length });
});

app.put('/api/tickets/:id', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
  if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ error: 'Нет доступа к тикету' });
  const statusCheck = validateTicketStatus(req.body.status, isStaffUser(req.user));
  if (!statusCheck.ok) return res.status(400).json({ error: statusCheck.error });
  const oldStatus = ticket.status;
  const newStatus = statusCheck.value;
  db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(newStatus, req.params.id);
  notifyDiscordTicketStatusChange(ticket, req.user, oldStatus, newStatus);
  res.json({ success: true });
});

app.delete('/api/admin/tickets/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
  db.prepare('DELETE FROM ticket_messages WHERE ticketId = ?').run(req.params.id);
  db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/tickets', authMiddleware, adminOnlyMiddleware, (req, res) => {
  db.prepare('DELETE FROM ticket_messages').run();
  db.prepare('DELETE FROM tickets').run();
  res.json({ success: true });
});

// ══════════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════════
app.get('/api/reviews', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const reviews = db.prepare(`
    SELECT id, userName, rating, text, createdAt 
    FROM reviews 
    WHERE status = 'approved'
    ORDER BY createdAt DESC 
    LIMIT ?
  `).all(limit);
  res.json(reviews);
});

app.post('/api/reviews', authMiddleware, (req, res) => {
  const input = validateReviewInput(req.body.rating, req.body.text);
  if (!input.ok) return res.status(400).json({ error: input.error });

  const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers WHERE userId = ?').get(req.user.id).count;
  if (serverCount === 0) return res.status(403).json({ error: 'Только клиенты с серверами могут оставлять отзывы' });

  const existing = db.prepare('SELECT id, status FROM reviews WHERE userId = ?').get(req.user.id);
  if (existing) {
    if (existing.status === 'pending') {
      return res.status(400).json({ error: 'Ваш отзыв уже на модерации' });
    }
    return res.status(400).json({ error: 'Вы уже оставили отзыв' });
  }

  const id = genId();
  db.prepare(`
    INSERT INTO reviews (id, userId, userName, rating, text, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, req.user.id, req.user.username, input.rating, input.text);

  const newReview = db.prepare('SELECT id, userName, rating, text, status, createdAt FROM reviews WHERE id = ?').get(id);
  res.json({
    ...newReview,
    message: 'Отзыв отправлен на модерацию. Он появится на сайте после проверки администратором.',
  });
});

app.get('/api/user/reviews', authMiddleware, (req, res) => {
  const reviews = db.prepare(`
    SELECT id, rating, text, status, createdAt 
    FROM reviews 
    WHERE userId = ?
    ORDER BY createdAt DESC
  `).all(req.user.id);
  res.json(reviews);
});

app.post('/api/admin/reviews/:id/approve', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const review = db.prepare('SELECT id, status FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
  db.prepare("UPDATE reviews SET status = 'approved' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/reviews/:id/reject', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
  db.prepare("UPDATE reviews SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/reviews/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/reviews', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const statusFilter = req.query.status;
  let reviews;
  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    reviews = db.prepare(`
      SELECT r.*, u.email 
      FROM reviews r
      JOIN users u ON u.id = r.userId
      WHERE r.status = ?
      ORDER BY r.createdAt DESC
    `).all(statusFilter);
  } else {
    reviews = db.prepare(`
      SELECT r.*, u.email 
      FROM reviews r
      JOIN users u ON u.id = r.userId
      ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.createdAt DESC
    `).all();
  }
  res.json(reviews);
});

// ══════════════════════════════════════════════════
// ADMIN: Users (с обновлением encryptedPassword)
// ══════════════════════════════════════════════════
app.get('/api/admin/users', authMiddleware, adminOnlyMiddleware, (_req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
  res.json(users.map(sanitizeAdminUser));
});

app.put('/api/admin/users/:id', authMiddleware, staffMiddleware, async (req, res) => {
  const { username, email, password, balance, role, blocked, banReason, banByIp, twoFactorEnabled } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const updates = [];
  const values = [];
  const changeLog = [];
  const fmtBool = (v) => (v ? 'да' : 'нет');
  const fmtBalance = (v) => `${Number(v)} ₽`;

  if (username !== undefined) {
    const nameCheck = validateUsername(username);
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
    const dup = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(nameCheck.value, req.params.id);
    if (dup) return res.status(400).json({ error: 'Имя пользователя уже занято' });
    updates.push('username = ?');
    values.push(nameCheck.value);
    if (nameCheck.value !== user.username) {
      changeLog.push(`Имя: ${user.username} → ${nameCheck.value}`);
    }
  }
  if (email !== undefined) {
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });
    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(emailCheck.value, req.params.id);
    if (dup) return res.status(400).json({ error: 'Email уже занят' });
    updates.push('email = ?');
    values.push(emailCheck.value);
    if (emailCheck.value !== user.email) {
      changeLog.push(`Email: ${user.email} → ${emailCheck.value}`);
    }
  }
  if (password) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Смена пароля пользователя — только для admin' });
    }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Пароль: минимум 8 символов, буквы и цифры' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    updates.push('password = ?');
    values.push(hashedPassword);
    const encrypted = encryptPassword(password);
    db.prepare('UPDATE users SET encryptedPassword = ? WHERE id = ?').run(encrypted, req.params.id);
    changeLog.push('Пароль: изменён');
  }
  if (balance !== undefined) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Изменение баланса — только для admin' });
    }
    const balCheck = parseBalance(balance);
    if (!balCheck.ok) return res.status(400).json({ error: balCheck.error });
    updates.push('balance = ?');
    values.push(balCheck.value);
    if (balCheck.value !== user.balance) {
      changeLog.push(`Баланс: ${fmtBalance(user.balance)} → ${fmtBalance(balCheck.value)}`);
    }
  }
  if (role !== undefined) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Изменение роли — только для admin' });
    }
    const roleCheck = validateRoleForActor(req.user.role, role);
    if (!roleCheck.ok) return res.status(400).json({ error: roleCheck.error });
    updates.push('role = ?');
    values.push(roleCheck.value);
    if (roleCheck.value !== user.role) {
      changeLog.push(`Роль: ${user.role} → ${roleCheck.value}`);
    }
  }
  let banApplied = false;
  if (blocked !== undefined) {
    const willBlock = !!blocked;
    if (willBlock) {
      const reasonCheck = validateBanReason(banReason ?? user.ban_reason ?? '');
      if (!reasonCheck.ok) return res.status(400).json({ error: reasonCheck.error });
      const wantIpBan = !!banByIp && req.user.role === 'admin';
      if (banByIp && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Блокировка по IP — только для администратора' });
      }
      if (!user.blocked) {
        const updatedUser = await applyUserBan(user, { reason: reasonCheck.value, banByIp: wantIpBan });
        banApplied = true;
        sendDiscordLog({
          color: 0xe74c3c,
          title: '🚫 Пользователь заблокирован',
          fields: [
            { name: 'Администратор', value: req.user.email, inline: true },
            { name: 'Пользователь', value: updatedUser.email || updatedUser.username, inline: true },
            { name: 'Причина', value: reasonCheck.value },
            { name: 'По IP', value: wantIpBan && updatedUser.last_login_ip ? 'да' : 'нет', inline: true },
          ],
          timestamp: new Date().toISOString(),
        }).catch(() => {});
        return res.json({
          ...sanitizeAdminUser(updatedUser),
          banWarning: wantIpBan && !updatedUser.last_login_ip
            ? 'IP-блокировка не применена: нет записи о последнем входе'
            : undefined,
        });
      }
      updates.push('blocked = ?', 'ban_reason = ?', 'ban_by_ip = ?');
      values.push(1, reasonCheck.value, wantIpBan ? 1 : 0);
      if (reasonCheck.value !== (user.ban_reason || '')) {
        changeLog.push(`Причина бана: ${user.ban_reason || '—'} → ${reasonCheck.value}`);
      }
      if (!!user.ban_by_ip !== wantIpBan) {
        changeLog.push(`Бан по IP: ${fmtBool(user.ban_by_ip)} → ${fmtBool(wantIpBan)}`);
      }
      if (wantIpBan && user.last_login_ip) upsertBannedIp(user.last_login_ip, user.id, reasonCheck.value);
      else if (!wantIpBan) db.prepare('DELETE FROM banned_ips WHERE user_id = ?').run(user.id);
    } else if (user.blocked) {
      clearUserBanData(req.params.id);
      changeLog.push('Блокировка: да → нет');
    } else {
      updates.push('blocked = ?');
      values.push(0);
    }
  }

  if (twoFactorEnabled !== undefined && twoFactorEnabled === false) {
    updates.push('twoFactorSecret = NULL, twoFactorEnabled = 0');
    if (user.twoFactorEnabled) {
      changeLog.push('2FA: включена → отключена');
    }
  }

  if (updates.length === 0 && !banApplied && changeLog.length === 0) {
    return res.status(400).json({ error: 'Нет полей для обновления' });
  }

  values.push(req.params.id);
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  try {
    if (updates.length > 0) db.prepare(query).run(...values);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (changeLog.length > 0) {
      sendDiscordLog({
        color: 0x9b59b6,
        title: '👑 Администратор изменил пользователя',
        fields: [
          { name: 'Администратор', value: req.user.email, inline: true },
          { name: 'Пользователь', value: updated.email, inline: true },
          { name: 'Изменения', value: changeLog.join('\n').slice(0, 1024) },
        ],
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }

    res.json(sanitizeAdminUser(updated));
  } catch (error) {
    console.error('[PUT /api/admin/users/:id] Error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении пользователя' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ADMIN: Servers
app.get('/api/admin/servers', authMiddleware, adminOnlyMiddleware, (_req, res) => {
  const servers = db.prepare('SELECT * FROM servers ORDER BY createdAt DESC').all();
  res.json(servers);
});

app.put('/api/admin/servers/:id', authMiddleware, adminOnlyMiddleware, async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const allowedFields = [
    'name', 'tariffId', 'tariffName', 'tariffTier', 'ram', 'cores', 'disk',
    'price', 'status', 'expiresAt', 'ip', 'port', 'pterodactylServerId',
    'pterodactylIdentifier', 'pterodactylUuid', 'node', 'autoRenew', 'type', 'os_template'
  ];
  const updates = [];
  const values = [];
  let shouldUpdatePtero = false;
  let newRam = server.ram;
  let newCores = server.cores;
  let newDisk = server.disk;
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      let value = req.body[field];
      if (field === 'autoRenew' && typeof value === 'boolean') value = value ? 1 : 0;
      updates.push(`${field} = ?`);
      values.push(value);
      if (field === 'ram') newRam = value;
      if (field === 'cores') newCores = value;
      if (field === 'disk') newDisk = value;
    }
  }
  const resourcesChanged = (newRam !== server.ram || newCores !== server.cores || newDisk !== server.disk);
  if (resourcesChanged && server.pterodactylServerId) shouldUpdatePtero = true;
  if (shouldUpdatePtero) {
    try {
      await updatePterodactylResources(server.pterodactylServerId, newRam, newCores, newDisk);
    } catch (pteroError) {
      console.error('[PTERO] Failed to update server resources in admin edit:', pteroError);
      return res.status(500).json({ error: 'Не удалось обновить ресурсы в Pterodactyl: ' + pteroError.message });
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
  values.push(req.params.id);
  const query = `UPDATE servers SET ${updates.join(', ')} WHERE id = ?`;
  try {
    db.prepare(query).run(...values);
    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (updated && updated.autoRenew !== undefined) updated.autoRenew = !!updated.autoRenew;
    res.json(updated);
  } catch (error) {
    console.error('[PUT /api/admin/servers/:id] Error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении сервера' });
  }
});

app.delete('/api/admin/servers/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════
// PROMO CODES
// ══════════════════════════════════════════════════
app.post('/api/promo/validate', authMiddleware, (req, res) => {
  const { code, amount, context } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите промокод' });
  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(normalizePromoCode(code));
  const check = validatePromoForUser(promo, req.user.id, Number(amount) || 0, context || 'purchase');
  if (!check.ok) return res.status(400).json({ error: check.error });
  res.json({
    valid: true,
    code: promo.code,
    type: promo.type,
    discount: check.discount,
    finalAmount: check.finalAmount,
    message: promo.type === 'balance'
      ? `На баланс будет начислено ${promo.value}₽`
      : `Скидка: ${check.discount}₽`,
  });
});

app.post('/api/promo/activate', authMiddleware, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите промокод' });
  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(normalizePromoCode(code));
  const check = validatePromoForUser(promo, req.user.id, 0, 'topup');
  if (!check.ok) return res.status(400).json({ error: check.error });
  if (promo.type !== 'balance') {
    return res.status(400).json({ error: 'Этот промокод применяется только при покупке сервера' });
  }
  redeemPromo(promo.id, req.user.id, 'topup', promo.value);
  creditPromoBalance(req.user.id, promo.value);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, credited: promo.value, balance: user.balance, message: `Начислено ${promo.value}₽` });
});

app.get('/api/admin/promo', authMiddleware, adminOnlyMiddleware, (_req, res) => {
  const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json(promos);
});

app.post('/api/admin/promo', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const { code, type, value, max_uses, per_user_limit, min_amount, expires_at, active } = req.body;
  if (!code || !type || value === undefined) return res.status(400).json({ error: 'Заполните код, тип и значение' });
  const normalized = normalizePromoCode(code);
  if (db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(normalized)) {
    return res.status(400).json({ error: 'Промокод уже существует' });
  }
  const id = genId();
  db.prepare(`INSERT INTO promo_codes (id, code, type, value, max_uses, per_user_limit, min_amount, expires_at, active)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    id, normalized, type, Number(value),
    max_uses != null && max_uses !== '' ? Number(max_uses) : null,
    per_user_limit != null ? Number(per_user_limit) : 1,
    min_amount != null ? Number(min_amount) : 0,
    expires_at || null,
    active === false ? 0 : 1
  );
  res.json(db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id));
});

app.put('/api/admin/promo/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Промокод не найден' });
  const { type, value, max_uses, per_user_limit, min_amount, expires_at, active } = req.body;
  db.prepare(`UPDATE promo_codes SET type=?, value=?, max_uses=?, per_user_limit=?, min_amount=?, expires_at=?, active=? WHERE id=?`).run(
    type ?? existing.type,
    value !== undefined ? Number(value) : existing.value,
    max_uses !== undefined ? (max_uses === '' || max_uses === null ? null : Number(max_uses)) : existing.max_uses,
    per_user_limit !== undefined ? Number(per_user_limit) : existing.per_user_limit,
    min_amount !== undefined ? Number(min_amount) : existing.min_amount,
    expires_at !== undefined ? expires_at : existing.expires_at,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id));
});

app.delete('/api/admin/promo/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
  db.prepare('DELETE FROM promo_redemptions WHERE promo_id = ?').run(req.params.id);
  db.prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════
// REFERRALS
// ══════════════════════════════════════════════════
app.get('/api/referrals/me', authMiddleware, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM users WHERE referred_by = ?').get(req.user.id).c;
  const referrals = db.prepare(
    'SELECT id, username, email, createdAt FROM users WHERE referred_by = ? ORDER BY createdAt DESC LIMIT 50'
  ).all(req.user.id);
  res.json({ count, referrals, link: `https://austocloud.fun/register?ref=${req.user.id}` });
});

app.get('/api/admin/referrals', authMiddleware, adminOnlyMiddleware, (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id as referrer_id, u.username as referrer_username, u.email as referrer_email,
           COUNT(r.id) as referral_count
    FROM users u
    INNER JOIN users r ON r.referred_by = u.id
    GROUP BY u.id
    ORDER BY referral_count DESC
  `).all();
  const all = db.prepare(`
    SELECT r.id, r.username, r.email, r.createdAt, r.referred_by,
           ref.username as referrer_username, ref.email as referrer_email
    FROM users r
    LEFT JOIN users ref ON ref.id = r.referred_by
    WHERE r.referred_by IS NOT NULL
    ORDER BY r.createdAt DESC
  `).all();
  res.json({ summary: rows, registrations: all });
});

// ══════════════════════════════════════════════════
// TOP UP (Balance) + лог
// ══════════════════════════════════════════════════
app.post('/api/topup', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const amountCheck = parseMoneyAmount(req.body.amount, { min: 1, max: 100_000 });
  if (!amountCheck.ok) return res.status(400).json({ error: amountCheck.error });
  const amount = amountCheck.value;
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  sendDiscordLog({
    color: 0x2ecc71,
    title: '👑 Администратор пополнил баланс',
    fields: [
      { name: 'Администратор', value: req.user.email, inline: true },
      { name: 'Сумма', value: `${amount}₽`, inline: true },
      { name: 'Новый баланс', value: `${user.balance}₽`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  res.json({ user: sanitizeUser(user) });
});

// ══════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════
app.get('/api/transactions', authMiddleware, (req, res) => {
  const transactions = db.prepare(`
    SELECT id, userId, operation_id, amount, status, created_at 
    FROM transactions 
    WHERE userId = ? 
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(transactions);
});

// ══════════════════════════════════════════════════
// YooMoney
// ══════════════════════════════════════════════════
const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || '';

function buildYooMoneyPaymentUrl({ wallet, amount, label, successUrl }) {
  const params = new URLSearchParams({
    receiver: wallet,
    'quickpay-form': 'button',
    paymentType: 'AC',
    sum: String(amount),
    label,
    successURL: successUrl,
  });
  return `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;
}

function resolveYooMoneyPayment(label) {
  if (!label) return null;

  const temp = db.prepare('SELECT * FROM temp_payments WHERE order_id = ?').get(label);
  if (temp) {
    return {
      userId: temp.user_id,
      expectedAmount: temp.amount,
      orderId: temp.order_id,
      pending: temp.status === 'pending',
    };
  }

  if (label.startsWith('lmx_') || label.startsWith('ym_')) {
    const parts = label.split('_');
    if (parts.length >= 2) {
      return { userId: parts[1], expectedAmount: null, orderId: null, pending: true };
    }
  }

  return null;
}

app.post('/api/yoomoney/create', authMiddleware, (req, res) => {
  const amountCheck = parseMoneyAmount(req.body.amount, { min: 1, max: 100_000 });
  if (!amountCheck.ok) return res.status(400).json({ error: amountCheck.error });
  if (!YOOMONEY_WALLET) {
    console.error('[YOOMONEY] YOOMONEY_WALLET not configured');
    return res.status(500).json({ error: 'YooMoney не настроен. Обратитесь в поддержку.' });
  }

  const amount = amountCheck.value;
  const orderId = `ym_${req.user.id}_${Date.now()}`;
  db.prepare(`
    INSERT INTO temp_payments (order_id, user_id, amount, status, payment_method)
    VALUES (?, ?, ?, 'pending', 'yoomoney')
  `).run(orderId, req.user.id, amount);

  const successUrl = `${FRONTEND_URL}/success?amount=${amount}`;
  const paymentUrl = buildYooMoneyPaymentUrl({
    wallet: YOOMONEY_WALLET,
    amount,
    label: orderId,
    successUrl,
  });

  console.log(`[YOOMONEY] Created payment ${orderId} for user ${req.user.id}, amount=${amount}`);
  res.json({ payment_url: paymentUrl, order_id: orderId });
});

// YooMoney Callback (с детальным логом)
// ══════════════════════════════════════════════════
app.post('/api/yoomoney/callback', express.urlencoded({ extended: true }), (req, res) => {
  const params = req.body;
  console.log('[YOOMONEY] Callback received:', params);
  const isTest = params.test_notification === 'true' || params.test_notification === true || params.test_notification === '1';
  if (isTest) {
    console.log('[YOOMONEY] Test notification received — ignoring');
    return res.status(200).send('OK');
  }
  const required = ['notification_type', 'operation_id', 'amount', 'currency', 'datetime', 'sender', 'codepro', 'sha1_hash'];
  for (const p of required) {
    if (!params.hasOwnProperty(p)) {
      console.log('[YOOMONEY] Missing param:', p);
      return res.status(400).send('Missing parameter');
    }
  }
  const secret = process.env.YOOMONEY_SECRET;
  if (!secret) {
    console.error('[YOOMONEY] Secret not configured');
    return res.status(500).send('Server configuration error');
  }
  const hashStr = [
    params.notification_type,
    params.operation_id,
    params.amount,
    params.currency,
    params.datetime,
    params.sender || '',
    String(params.codepro),
    secret,
    params.label || '',
  ].join('&');
  const calculatedHash = crypto.createHash('sha1').update(hashStr).digest('hex');
  if (calculatedHash !== params.sha1_hash) {
    console.log('[YOOMONEY] Invalid hash!');
    console.log(`[YOOMONEY] Expected: ${calculatedHash}, got: ${params.sha1_hash}`);
    console.log(`[YOOMONEY] Hash string (secret hidden): ${hashStr.replace(secret, '***')}`);
    return res.status(400).send('Invalid hash');
  }

  if (params.unaccepted === 'true') {
    console.log('[YOOMONEY] Payment awaiting acceptance in wallet, skipping credit');
    return res.status(200).send('OK');
  }

  const payment = resolveYooMoneyPayment(params.label || '');
  if (!payment?.userId) {
    console.log('[YOOMONEY] Invalid or unknown label:', params.label);
    return res.status(400).send('Invalid label');
  }

  if (payment.orderId && !payment.pending) {
    console.log('[YOOMONEY] Order already processed:', payment.orderId);
    return res.status(200).send('OK');
  }

  const amountCheck = parseMoneyAmount(params.amount, { min: 1, max: 100_000 });
  if (!amountCheck.ok) {
    console.log('[YOOMONEY] Invalid amount:', params.amount);
    return res.status(400).send('Invalid amount');
  }

  if (payment.expectedAmount != null && Math.abs(amountCheck.value - payment.expectedAmount) > 0.01) {
    logError('YOOMONEY', 'Paid amount differs from order', {
      orderId: payment.orderId,
      expected: payment.expectedAmount,
      paid: amountCheck.value,
      userId: payment.userId,
    });
  }

  const result = creditUserBalance({
    userId: payment.userId,
    amount: amountCheck.value,
    operationId: `yoomoney_${params.operation_id}`,
    providerLabel: 'YooMoney',
    providerKey: 'YooMoney',
  });

  if (!result.ok) {
    console.error('[YOOMONEY] Credit failed:', result.error);
    return res.status(400).send(result.error);
  }

  if (result.duplicate) {
    console.log('[YOOMONEY] Operation already processed:', params.operation_id);
    return res.status(200).send('OK');
  }

  if (payment.orderId) {
    db.prepare('UPDATE temp_payments SET status = ? WHERE order_id = ?').run('completed', payment.orderId);
  }

  console.log(`[YOOMONEY] SUCCESS: Added ${result.amount} to user ${payment.userId} (operation: ${params.operation_id})`);
  res.status(200).send('OK');
});

// ══════════════════════════════════════════════════
// 2328.IO CRYPTO PAYMENT INTEGRATION (с логом)
// ══════════════════════════════════════════════════

function sign2328(data, apiKey) {
  const json = JSON.stringify(data);
  const base64 = Buffer.from(json).toString('base64');
  return crypto.createHmac('sha256', apiKey).update(base64).digest('hex');
}

app.post('/api/2328/create', authMiddleware, async (req, res) => {
  const amountCheck = parseMoneyAmount(req.body.amount, { min: 10, max: 100_000 });
  if (!amountCheck.ok) return res.status(400).json({ error: amountCheck.error });
  const amount = amountCheck.value;

  const orderId = `lmx_${req.user.id}_${Date.now()}`;
  const project = process.env.PAYMENT_2328_PROJECT;
  const apiKey = process.env.PAYMENT_2328_API_KEY;
  const callbackUrl = `${FRONTEND_URL}/api/2328/callback`;

  const payload = {
    amount: amount.toString(),
    currency: 'RUB',
    order_id: orderId,
    url_callback: callbackUrl,
    url_return: `${FRONTEND_URL}/success?amount=${amount}`,
  };
  const sign = sign2328(payload, apiKey);

  try {
    const response = await fetch('https://api.2328.io/api/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'project': project,
        'sign': sign,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.state === 0 && data.result && data.result.url) {
      db.prepare('INSERT INTO temp_payments (order_id, user_id, amount) VALUES (?, ?, ?)').run(orderId, req.user.id, amount);
      res.json({ payment_url: data.result.url });
    } else {
      throw new Error(data.message || 'Ошибка создания счёта');
    }
  } catch (err) {
    console.error('[2328] Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/2328/callback', express.json(), (req, res) => {
  const webhookData = req.body;
  const apiKey = process.env.PAYMENT_2328_API_KEY;
  const receivedSign = webhookData.sign;
  if (!receivedSign) return res.status(400).send('Missing signature');

  const dataWithoutSign = { ...webhookData };
  delete dataWithoutSign.sign;
  const expectedSign = sign2328(dataWithoutSign, apiKey);
  if (!safeTimingEqual(receivedSign, expectedSign)) {
    console.error('[2328] Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const { order_id, payment_status } = webhookData;
  if (payment_status === 'paid' || payment_status === 'overpaid') {
    const temp = db.prepare('SELECT * FROM temp_payments WHERE order_id = ?').get(order_id);
    if (temp && temp.status === 'pending') {
      const amountCheck = parseMoneyAmount(temp.amount, { min: 1, max: 100_000 });
      if (amountCheck.ok) {
        const amount = amountCheck.value;
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, temp.user_id);
        db.prepare('UPDATE temp_payments SET status = ? WHERE order_id = ?').run('completed', order_id);
        console.log(`[2328] Payment processed: ${order_id}, user ${temp.user_id}, +${amount}`);

        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(temp.user_id);
        sendDiscordLog({
          color: 0xf1c40f,
          title: '₿ Пополнение баланса (2328.io)',
          fields: [
            { name: 'Пользователь', value: user ? user.email : temp.user_id, inline: true },
            { name: 'Сумма', value: `${amount} ₽`, inline: true },
            { name: 'Order ID', value: order_id },
          ],
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  }
  res.status(200).send('OK');
});

// ══════════════════════════════════════════════════
// PLATEGA.IO PAYMENT INTEGRATION (с логом)
// ══════════════════════════════════════════════════

const PLATEGA_METHODS = {
  sbp: { code: 2, label: 'СБП', logKey: 'СБП' },
  foreign: { code: 12, label: 'Зарубежные карты', logKey: 'Зарубежные карты' },
  crypto: { code: 13, label: 'Crypto', logKey: 'Crypto' },
};

function resolvePlategaMethodConfig(method) {
  return PLATEGA_METHODS[method] || PLATEGA_METHODS.sbp;
}

function signPlatega(data, apiKey) {
  const json = JSON.stringify(data);
  return crypto.createHmac('sha256', apiKey).update(json).digest('hex');
}

app.post('/api/platega/create', authMiddleware, async (req, res) => {
  const amountCheck = parseMoneyAmount(req.body.amount, { min: 10, max: 100_000 });
  if (!amountCheck.ok) return res.status(400).json({ error: amountCheck.error });
  const amount = amountCheck.value;
  const { method } = req.body;
  if (method && !PLATEGA_METHODS[method]) {
    return res.status(400).json({ error: 'Неподдерживаемый способ оплаты Platega' });
  }
  const methodConfig = resolvePlategaMethodConfig(method);

  const orderId = `plg_${req.user.id}_${Date.now()}`;
  const merchantId = process.env.PLATEGA_MERCHANT_ID;
  const secretKey = process.env.PLATEGA_SECRET_KEY;
  const apiUrl = process.env.PLATEGA_API_URL || 'https://app.platega.io';

  if (!merchantId || !secretKey) {
    console.error('[PLATEGA] Merchant ID or Secret Key not configured');
    return res.status(500).json({ error: 'Платежная система не настроена' });
  }

  const payload = {
    paymentMethod: methodConfig.code,
    paymentDetails: {
      amount: amount,
      currency: 'RUB',
    },
    description: `Пополнение баланса в ${APP_NAME}`,
    return: `${FRONTEND_URL}/success?amount=${amount}`,
    failedUrl: `${FRONTEND_URL}/dashboard/topup?success=false`,
    payload: JSON.stringify({ userId: req.user.id, orderId: orderId }),
  };

  const sign = signPlatega(payload, secretKey);

  try {
    const response = await fetch(`${apiUrl}/transaction/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MerchantId': merchantId,
        'X-Secret': secretKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Ошибка создания платежа');
    }

    if (data.redirect) {
      const gatewayRef = pickPlategaTransactionId(data);
      db.prepare('INSERT INTO temp_payments (order_id, user_id, amount, status, gateway_ref, payment_method) VALUES (?, ?, ?, ?, ?, ?)')
        .run(orderId, req.user.id, amount, 'pending', gatewayRef ? String(gatewayRef) : null, method || 'sbp');
      console.log(`[PLATEGA] Created payment ${orderId}, method=${method || 'sbp'}, gateway_ref=${gatewayRef || 'none'}, amount=${amount}`);
      res.json({ payment_url: data.redirect });
    } else {
      throw new Error('Не получена ссылка на оплату');
    }
  } catch (err) {
    console.error('[PLATEGA] Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/platega/callback', express.json(), (req, res) => {
  const webhookData = req.body || {};
  console.log('[PLATEGA] Callback received:', JSON.stringify(webhookData));

  if (!verifyPlategaCallback(req)) {
    console.warn('[PLATEGA] Callback rejected: invalid X-MerchantId or X-Secret');
    return res.status(401).send('Unauthorized');
  }

  const status = normalizePlategaStatus(webhookData);
  if (!isPlategaPaidStatus(status)) {
    console.log(`[PLATEGA] Callback status: ${status || '(empty)'}, ignoring`);
    return res.status(200).send('OK');
  }

  const temp = resolvePlategaTempPayment(webhookData);
  if (!temp) {
    console.warn('[PLATEGA] Payment record not found for callback', pickPlategaTransactionId(webhookData));
    return res.status(200).send('OK');
  }
  if (temp.status && temp.status !== 'pending') {
    console.log(`[PLATEGA] Order ${temp.order_id} already processed (status=${temp.status})`);
    return res.status(200).send('OK');
  }

  const callbackAmount = pickPlategaCallbackAmount(webhookData);
  const amountToCredit = callbackAmount ?? temp.amount;
  const opId = `platega_${temp.order_id}`;
  const methodConfig = resolvePlategaMethodConfig(temp.payment_method);
  const result = creditUserBalance({
    userId: temp.user_id,
    amount: amountToCredit,
    operationId: opId,
    providerLabel: 'Platega',
    providerKey: methodConfig.logKey,
  });

  if (result.ok && !result.duplicate) {
    db.prepare('UPDATE temp_payments SET status = ? WHERE order_id = ?').run('completed', temp.order_id);
    console.log(`[PLATEGA] SUCCESS: +${result.amount} user ${temp.user_id} (${temp.order_id})`);
  } else if (result.duplicate) {
    console.log(`[PLATEGA] Duplicate callback for ${temp.order_id}`);
  } else {
    console.error('[PLATEGA] Credit failed:', result.error);
  }

  res.status(200).send('OK');
});

// ══════════════════════════════════════════════════
// ПОЛУЧЕНИЕ СПИСКА НОД
// ══════════════════════════════════════════════════

app.get('/api/nodes', authMiddleware, async (req, res) => {
  try {
    const nodesData = await ptero('GET', '/nodes?per_page=100');
    const nodes = await Promise.all(nodesData.data
      .filter(node => PTERO_PURCHASE_NODE_IDS.includes(node.attributes.id))
      .map(async (node) => {
        const id = node.attributes.id;
        const policyOverloaded = isPteroNodeOverloaded(id);
        const capacityAvailable = policyOverloaded ? false : await isPteroNodeCapacityAvailable(id);
        const overloaded = policyOverloaded || !capacityAvailable;
        return {
          id,
          name: node.attributes.name,
          description: node.attributes.description,
          location_id: node.attributes.location_id,
          public: node.attributes.public,
          maintenance_mode: node.attributes.maintenance_mode,
          memory: node.attributes.memory,
          disk: node.attributes.disk,
          servers_count: node.attributes.servers_count,
          label: getPteroLocationLabel(id),
          overloaded,
          overloadedMessage: policyOverloaded
            ? 'Сервис переполнен'
            : !capacityAvailable
              ? 'Нет свободных портов'
              : null,
        };
      }));
    res.json(nodes);
  } catch (error) {
    console.error('[API] /api/nodes error:', error);
    res.status(500).json({ error: 'Ошибка получения списка нод' });
  }
});

app.get('/api/purchase-locations', authMiddleware, async (_req, res) => {
  const baseLocations = [
    { nodeId: 1, label: 'Германия 1', shortLabel: 'DE-1' },
    { nodeId: 2, label: 'Германия 2', shortLabel: 'DE-2' },
  ];
  try {
    const locations = await Promise.all(baseLocations.map(async (loc) => {
      const policyOverloaded = isPteroNodeOverloaded(loc.nodeId);
      const capacityAvailable = policyOverloaded ? false : await isPteroNodeCapacityAvailable(loc.nodeId);
      const overloaded = policyOverloaded || !capacityAvailable;
      return {
        ...loc,
        overloaded,
        overloadedMessage: policyOverloaded
          ? 'Сервис переполнен'
          : !capacityAvailable
            ? 'Нет свободных портов'
            : null,
      };
    }));
    res.json(locations);
  } catch (error) {
    console.error('[API] /api/purchase-locations error:', error);
    res.json(baseLocations.map(loc => ({
      ...loc,
      overloaded: isPteroNodeOverloaded(loc.nodeId),
      overloadedMessage: isPteroNodeOverloaded(loc.nodeId) ? 'Сервис переполнен' : null,
    })));
  }
});

// ══════════════════════════════════════════════════
// ПОЛУЧЕНИЕ СПИСКА ОДНОРАЗОВЫХ ТАРИФОВ
// ══════════════════════════════════════════════════
app.get('/api/user/once-purchased', authMiddleware, (req, res) => {
  try {
    const purchased = db.prepare('SELECT tariff_id FROM once_purchases WHERE user_id = ?').all(req.user.id);
    const tariffIds = purchased.map(row => row.tariff_id);
    res.json({ tariffIds });
  } catch (error) {
    console.error('[API] /api/user/once-purchased error:', error);
    res.status(500).json({ error: 'Ошибка загрузки данных' });
  }
});

// ══════════════════════════════════════════════════
// РАССЫЛКА EMAIL (админский эндпоинт)
// ══════════════════════════════════════════════════
app.post('/api/admin/send-email', authMiddleware, adminOnlyMiddleware, async (req, res) => {
  const { to, subject, html, userId } = req.body;
  if (!subject || !html) {
    return res.status(400).json({ error: 'Не указана тема или текст письма' });
  }
  if (!transporter) {
    return res.status(500).json({ error: 'SMTP не настроен' });
  }

  try {
    let recipients = [];
    if (userId) {
      const user = db.prepare('SELECT email, username FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      recipients = [{ email: user.email, username: user.username }];
    } else if (to === 'all') {
      recipients = db.prepare('SELECT email, username FROM users WHERE email IS NOT NULL AND email != ""').all();
    } else if (to && to.includes('@')) {
      recipients = [{ email: to, username: '' }];
    } else {
      return res.status(400).json({ error: 'Неверный получатель' });
    }

    let sentCount = 0;
    for (const rec of recipients) {
      if (!rec.email) continue;
      const mailOptions = {
        from: smtpConfig.from,
        to: rec.email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family: Arial, sans-serif; background-color: #0b0f1a; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #131927; border-radius: 24px; padding: 30px; border: 1px solid #2a3346;">
              <h2 style="color: #fff;">${subject.replace(/</g, '&lt;')}</h2>
              <div style="color: #e0e7ff;">${html}</div>
              <hr style="border-color: #2a3346; margin: 20px 0;">
              <p style="color: #7f8fb2; font-size: 12px;">Это письмо отправлено с сервера ${APP_NAME}.</p>
            </div>
          </body>
          </html>
        `,
      };
      await transporter.sendMail(mailOptions);
      sentCount++;
    }
    res.json({ success: true, message: `Отправлено ${sentCount} писем` });
  } catch (err) {
    console.error('[EMAIL] Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
// КРАСИВАЯ СТРАНИЦА УСПЕШНОЙ ОПЛАТЫ
// ══════════════════════════════════════════════════
app.get('/success', (req, res) => {
  const amount = req.query.amount ? parseFloat(req.query.amount) : null;
  const dashboardUrl = `${FRONTEND_URL}/dashboard`;
  const amountHtml = amount ? `<div class="info-row"><span class="info-label">Сумма пополнения</span><span class="info-value">${amount.toLocaleString()} ₽</span></div>` : '';
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
      <title>Оплата прошла успешно — ${APP_NAME}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { min-height: 100vh; background: radial-gradient(circle at 10% 20%, rgba(10,15,31,1) 0%, rgba(5,8,22,1) 100%); font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .container { max-width: 560px; width: 100%; background: rgba(15, 25, 45, 0.7); backdrop-filter: blur(16px); border-radius: 56px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 30px 50px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05); padding: 48px 36px; text-align: center; transition: all 0.4s ease; animation: floatIn 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes floatIn { 0% { opacity: 0; transform: scale(0.96) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .icon { width: 110px; height: 110px; background: linear-gradient(145deg, #10b981, #059669); border-radius: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 28px; box-shadow: 0 20px 35px -12px rgba(16,185,129,0.5); animation: bouncePop 0.6s ease-out 0.2s both; }
        @keyframes bouncePop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        .icon svg { width: 60px; height: 60px; stroke: white; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        h1 { font-size: 34px; font-weight: 700; background: linear-gradient(135deg, #fff, #a0c0ff); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 12px; letter-spacing: -0.3px; }
        .subtitle { font-size: 18px; color: rgba(255,255,255,0.7); margin-bottom: 32px; line-height: 1.4; }
        .card { background: rgba(255,255,255,0.03); border-radius: 36px; padding: 24px; margin: 24px 0; border: 1px solid rgba(255,255,255,0.08); text-align: left; backdrop-filter: blur(4px); }
        .info-row { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 16px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: rgba(255,255,255,0.6); font-weight: 500; }
        .info-value { color: #fff; font-weight: 700; background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 40px; }
        .button { display: inline-flex; align-items: center; justify-content: center; gap: 14px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border: none; border-radius: 60px; padding: 18px 36px; font-size: 18px; font-weight: 600; color: white; cursor: pointer; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 10px 25px -8px rgba(59,130,246,0.5); width: 100%; max-width: 300px; margin-top: 16px; }
        .button:hover { transform: translateY(-3px); box-shadow: 0 20px 35px -12px rgba(59,130,246,0.6); background: linear-gradient(135deg, #2563eb, #7c3aed); }
        .button svg { width: 22px; height: 22px; stroke: white; stroke-width: 2; fill: none; }
        .footer { margin-top: 32px; font-size: 13px; color: rgba(255,255,255,0.4); }
        @media (max-width: 550px) { .container { padding: 32px 24px; } h1 { font-size: 28px; } .button { font-size: 16px; padding: 14px 24px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          <svg viewBox="0 0 24 24" stroke="currentColor">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1>Оплата успешно завершена!</h1>
        <div class="subtitle">Ваш баланс пополнен.<br>Спасибо, что выбираете нас.</div>
        <div class="card">
          <div class="info-row">
            <span class="info-label">Время операции</span>
            <span class="info-value" id="time"></span>
          </div>
          ${amountHtml}
          <div class="info-row">
            <span class="info-label">Статус</span>
            <span class="info-value" style="color: #34d399;">Успешно</span>
          </div>
        </div>
        <a href="${dashboardUrl}" class="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-5v-7H9v7H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          В личный кабинет
        </a>
        <div class="footer">Если у вас возникли вопросы, напишите в поддержку</div>
      </div>
      <script>
        document.getElementById('time').innerText = new Date().toLocaleString('ru-RU', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        setTimeout(() => { window.location.href = '${dashboardUrl}'; }, 6000);
      </script>
    </body>
    </html>
  `);
});
// ══════════════════════════════════════════════════
// PTERODACTYL API PROXY
// ══════════════════════════════════════════════════
app.get('/api/ptero/test', authMiddleware, async (req, res) => {
  try {
    const data = await ptero('GET', '/servers?per_page=1');
    if (req.user.role === 'admin') {
      res.json({ success: true, total_servers: data.meta?.pagination?.total ?? 0 });
    } else {
      res.json({ success: true });
    }
  } catch (e) {
    res.status(503).json({ success: false, error: 'Система создания серверов временно недоступна' });
  }
});

app.get('/api/ptero/servers', authMiddleware, adminOnlyMiddleware, async (_req, res) => {
  try { res.json(await ptero('GET', '/servers?include=allocations,user&per_page=100')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ptero/users', authMiddleware, adminOnlyMiddleware, async (_req, res) => {
  try { res.json(await ptero('GET', '/users?per_page=100')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ptero/servers/:id/suspend', authMiddleware, adminOnlyMiddleware, async (req, res) => {
  try { await ptero('POST', `/servers/${req.params.id}/suspend`); res.json({ success: true }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post('/api/ptero/servers/:id/unsuspend', authMiddleware, adminOnlyMiddleware, async (req, res) => {
  try { await ptero('POST', `/servers/${req.params.id}/unsuspend`); res.json({ success: true }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.delete('/api/ptero/servers/:id', authMiddleware, adminOnlyMiddleware, async (req, res) => {
  try { await ptero('DELETE', `/servers/${req.params.id}/force`); res.json({ success: true }); }
  catch { try { await ptero('DELETE', `/servers/${req.params.id}`); res.json({ success: true }); } catch (e2) { res.status(500).json({ error: e2.message }); } }
});

// ========== ИСПРАВЛЕННЫЙ PROVISION (начало: проверка баланса, списание, возврат денег) ==========
app.post('/api/ptero/provision', authMiddleware, sensitiveApiLimiter, async (req, res) => {
  let { serverName, ram, disk, cpu, coreName, serverType, nodeId, tariffId, osTemplate, months, promoCode } = req.body;
  const email = req.user.email;
  const username = req.user.username;
  let provisionStage = 'validation';
  let wasRefunded = false;

  const nameCheck = validateServerName(serverName);
  if (!nameCheck.ok) return res.status(400).json({ success: false, error: nameCheck.error, stage: provisionStage });

  serverName = nameCheck.value;

  const provisionContext = () => maskSensitiveData({
    email,
    username,
    userId: req.user.id,
    serverName,
    serverType: serverType || 'game',
    coreName: coreName || null,
    ram,
    disk,
    cpu,
    nodeId: nodeId || null,
    tariffId: tariffId || null,
    osTemplate: osTemplate || null,
    months: months ?? 1,
  });

  console.log(`\n[PROVISION] === НАЧАЛО СОЗДАНИЯ СЕРВЕРА ===`);
  console.log(`[PROVISION] Email: ${email}, Username: ${username}, Server: ${serverName}`);
  console.log(`[PROVISION] Тип: ${serverType || 'game'}, Ядро: ${coreName || 'не указано'}, RAM: ${ram} MB, CPU: ${cpu} cores, Disk: ${disk} MB`);
  console.log(`[PROVISION] Выбранная нода: ${nodeId || 'автоматический выбор'}`);
  console.log(`[PROVISION] tariffId: ${tariffId || 'не указан'}`);
  if (serverType === 'vps') console.log(`[PROVISION] OS Template: ${osTemplate || 'не указан'}`);

  try {
    // ======== БЛОК ПРОВЕРКИ И ОПЛАТЫ ========
    provisionStage = 'months_validation';
    const monthsCheck = parseRenewMonths(months ?? 1);
    if (!monthsCheck.ok) return res.status(400).json({ success: false, error: monthsCheck.error });
    const actualMonths = monthsCheck.value;

    let tariff = null;
    if (tariffId) {
      tariff = db.prepare('SELECT * FROM plans WHERE id = ?').get(tariffId);
      if (!tariff) return res.status(400).json({ success: false, error: 'Тариф не найден' });
      const tariffSpecs = validatePlanRecord(tariff);
      if (!tariffSpecs.ok) return res.status(400).json({ success: false, error: 'Тариф недоступен (некорректная конфигурация)' });
      if (req.user.role !== 'admin') {
        ram = tariff.ram;
        disk = tariff.disk;
        cpu = tariff.cores;
      }
    }

    // Переменная для хранения стоимости (нужна для возврата)
    let totalCost = 0;

    // Функция возврата денег при ошибке (только для не-админов)
    const refund = () => {
      if (req.user.role !== 'admin' && totalCost > 0) {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(totalCost, req.user.id);
        req.user.balance += totalCost;
        wasRefunded = true;
        console.log(`[PROVISION] Возврат ${totalCost}₽ пользователю ${req.user.email}`);
        logError('PROVISION', `Возврат ${totalCost}₽ после ошибки на этапе ${provisionStage}`, {
          ...provisionContext(),
          stage: provisionStage,
          totalCost,
        });
      }
      return wasRefunded;
    };

    if (serverType !== 'vps') {
      provisionStage = 'node_check';
      if (!nodeId || !isAllowedPteroNode(nodeId)) {
        return res.status(400).json({ success: false, error: 'Выберите локацию: Германия 1 или Германия 2' });
      }
      if (isPteroNodeOverloaded(nodeId)) {
        return res.status(503).json({
          success: false,
          error: getPteroNodeOverloadMessage(nodeId),
          stage: provisionStage,
        });
      }
      try {
        await assertPteroNodeReachable(nodeId);
        console.log(`[PROVISION] Node ${nodeId} (${getPteroLocationLabel(nodeId)}) is ready, free allocations available`);
      } catch (nodeErr) {
        const noAlloc = nodeErr?.code === 'no_allocations' || String(nodeErr.message || '').includes('Нет свободных аллокаций');
        logError('PROVISION', noAlloc ? 'No free allocations before payment' : 'Node check failed before payment', {
          ...provisionContext(),
          stage: provisionStage,
          stack: nodeErr.stack,
          status: nodeErr.status,
          code: noAlloc ? 'no_allocations' : 'node_unavailable',
        });
        return res.status(503).json({
          success: false,
          error: formatPteroUserError(nodeErr, { stage: provisionStage, nodeId }),
          code: noAlloc ? 'no_allocations' : 'node_unavailable',
          stage: provisionStage,
        });
      }
    }

    // Для обычных пользователей (не админов) проверяем баланс и списываем
    provisionStage = 'payment';
    if (req.user.role !== 'admin') {
      if (!tariff) {
        return res.status(400).json({ success: false, error: 'Не указан тариф' });
      }
      if (tariff.price < 0) {
        return res.status(400).json({ success: false, error: 'Некорректная цена тарифа' });
      }

      totalCost = tariff.price * actualMonths;

      let appliedPromo = null;
      if (promoCode && totalCost > 0) {
        const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(normalizePromoCode(promoCode));
        const check = validatePromoForUser(promo, req.user.id, totalCost, 'purchase');
        if (!check.ok) return res.status(400).json({ success: false, error: check.error });
        appliedPromo = check.promo;
        totalCost = check.finalAmount;
      }

      if (totalCost > 0 && req.user.balance < totalCost) {
        return res.status(400).json({ success: false, error: 'Недостаточно средств на балансе' });
      }

      // Проверка once_per_account перед списанием
      if (tariff.once_per_account === 1) {
        const alreadyPurchased = db.prepare('SELECT id FROM once_purchases WHERE user_id = ? AND tariff_id = ?').get(req.user.id, tariffId);
        if (alreadyPurchased) {
          return res.status(400).json({ success: false, error: 'Этот тариф можно приобрести только один раз на аккаунт.' });
        }
      }

      // Проверка node_id перед списанием
      if (tariff.node_id !== null && isPteroNodeOverloaded(tariff.node_id)) {
        return res.status(503).json({
          success: false,
          error: getPteroNodeOverloadMessage(tariff.node_id),
          stage: provisionStage,
        });
      }

      if (tariff.node_id !== null && tariff.node_id !== nodeId) {
        return res.status(400).json({ success: false, error: `Этот тариф можно создать только на ноде ${tariff.node_id}` });
      }

      // Списываем деньги (бесплатные тарифы — 0₽)
      if (totalCost > 0) {
        db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(totalCost, req.user.id);
        req.user.balance -= totalCost;
        console.log(`[PROVISION] Списано ${totalCost}₽ у пользователя ${req.user.email}. Новый баланс: ${req.user.balance}₽`);
      } else {
        console.log(`[PROVISION] Бесплатный тариф — списание не требуется (${req.user.email})`);
      }

      if (appliedPromo) {
        redeemPromo(appliedPromo.id, req.user.id, 'purchase', totalCost);
        if (appliedPromo.type === 'balance') {
          creditPromoBalance(req.user.id, appliedPromo.value);
          req.user.balance += appliedPromo.value;
        }
      }
    }

        // Основной блок создания сервера (VDS / Game / Coding)
    try {
      // ========== VDS через Proxmox ==========
      if (serverType === 'vps') {
        provisionStage = 'vps_prepare';
        if (!proxmox.config.host || !proxmox.config.tokenId) {
          throw new Error('Система VDS временно недоступна.');
        }
        if (!osTemplate) {
          throw new Error('Не выбран шаблон операционной системы');
        }

        const safeRam = Math.max(ram, 512);
        const safeDisk = Math.max(disk, 5120);
        const diskGb = Math.ceil(safeDisk / 1024);
        const safeCpu = Math.min(Math.max(cpu, 1), 32);
        const safeSwap = Math.max(Math.floor(safeRam / 2), 256);

        // Автоматически определяем хранилище для контейнеров
        const containerStorage = await proxmox.getContainerStorage();
        console.log(`[PROVISION] Используем хранилище для контейнеров: ${containerStorage}`);
        const rootfs = `${containerStorage}:${diskGb}`;

        const vmid = await proxmox.getNextVMID();

        // Удаляем возможный конфликтующий контейнер
        try {
          await proxmox.getLXCStatus(vmid);
          console.log(`[PROVISION] VMID ${vmid} already exists, deleting...`);
          await proxmox.deleteLXC(vmid);
          console.log(`[PROVISION] Deleted existing container with VMID ${vmid}`);
        } catch (err) { /* не существует – ок */ }

        // === ИСПОЛЬЗУЕМ ПАРОЛЬ ИЗ БИЛЛИНГА ===
        // === БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ПАРОЛЯ (с обработкой ошибки расшифровки) ===
let password;
try {
  if (req.user.encryptedPassword) {
    const decrypted = decryptPassword(req.user.encryptedPassword);
    if (decrypted) {
      password = decrypted;
      console.log('[PROVISION] Successfully decrypted user password');
    } else {
      throw new Error('Empty decryption result');
    }
  } else {
    throw new Error('No encrypted password');
  }
} catch (decryptError) {
  console.warn('[PROVISION] Failed to decrypt stored password, generating new one:', decryptError.message);
  password = genPassword();
  // Шифруем и сохраняем новый пароль
  const newEncrypted = encryptPassword(password);
  db.prepare('UPDATE users SET encryptedPassword = ? WHERE id = ?').run(newEncrypted, req.user.id);
  console.log('[PROVISION] New password generated and stored encrypted');
}
// === КОНЕЦ БЛОКА ПОЛУЧЕНИЯ ПАРОЛЯ ===

        let safeHostname = serverName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/^-+|-+$/g, '')
          .replace(/--+/g, '-')
          .substring(0, 63);
        if (!safeHostname) safeHostname = `vds-${vmid}`;

        console.log(`[PROVISION] Создание VDS на Proxmox. VMID: ${vmid}, RAM: ${safeRam} MB, CPU: ${safeCpu}, DISK: ${safeDisk} MB (${diskGb} GB), OS: ${osTemplate}, rootfs: ${rootfs}`);

        provisionStage = 'vps_create';
        const createResult = await proxmox.createLXC({
          vmid,
          hostname: safeHostname,
          password: password,
          cores: safeCpu,
          memory: safeRam,
          swap: safeSwap,
          storage: containerStorage,
          ostemplate: osTemplate,
          rootfs: rootfs,
        });
        console.log(`[PROVISION] Создание контейнера VMID ${vmid} запущено, UPID: ${createResult.upid}. Ожидание завершения...`);
        await proxmox.waitForTask(createResult.upid);
        console.log(`[PROVISION] Контейнер VMID ${vmid} успешно создан.`);

        provisionStage = 'vps_start';
        const startResult = await proxmox.startLXC(vmid);
        console.log(`[PROVISION] Запуск контейнера VMID ${vmid}, UPID: ${startResult}. Ожидание...`);
        await proxmox.waitForTask(startResult);
        console.log(`[PROVISION] Контейнер VMID ${vmid} запущен.`);

        // Ожидаем инициализацию сети и получаем IP через интерфейсы
        provisionStage = 'vps_network';
        let ip = null;
        console.log('[PROVISION] Waiting for container to initialize...');
        await new Promise(resolve => setTimeout(resolve, 8000));

        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            const interfaces = await proxmox.getLXCInterfaces(vmid);
            const iface = interfaces.find(i => i.name === 'eth0');
            if (iface && iface.addresses && iface.addresses.length > 0) {
              const ipv4 = iface.addresses.find(a => a.family === 'inet');
              if (ipv4) {
                ip = ipv4.address;
                console.log(`[PROVISION] IP obtained via interfaces: ${ip}`);
                break;
              }
            }
            console.log(`[PROVISION] Attempt ${attempt + 1}: no IP yet, waiting...`);
            if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (err) {
            console.warn(`[PROVISION] Attempt ${attempt + 1} failed: ${err.message}`);
            if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        if (!ip) console.warn('[PROVISION] Could not obtain IP after multiple attempts');

        // ========== СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ PROXMOX И ВЫДАЧА ПРАВ ==========
        provisionStage = 'vps_user';
        const proxmoxUserBase = (username || email.split('@')[0]).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 20);
        const proxmoxUserid = proxmoxUserBase + '@pve';
        const proxmoxPassword = password;

        try {
          const existingUser = await proxmox.getUser(proxmoxUserid);
          if (!existingUser) {
            await proxmox.createUser(proxmoxUserid, proxmoxPassword, email, username || '', APP_NAME);
            console.log(`[PROVISION] Proxmox user ${proxmoxUserid} created.`);
          } else {
            console.log(`[PROVISION] Proxmox user ${proxmoxUserid} already exists, skipping creation.`);
          }

          await proxmox.setUserACL(proxmoxUserid, `/vms/${vmid}`, 'PVEVMUser');
          console.log(`[PROVISION] ACL set for ${proxmoxUserid} on /vms/${vmid}.`);

          db.prepare('UPDATE servers SET proxmoxPassword = ? WHERE id = ?')
            .run(proxmoxPassword, vmid);
        } catch (userError) {
          logError('PROVISION', 'Failed to setup Proxmox user', {
            ...provisionContext(),
            stage: provisionStage,
            vmid,
            stack: userError.stack,
          });
        }

        provisionStage = 'vps_email';
        try {
          const vdsTpl = buildVdsReadyEmail(APP_NAME, {
            username,
            serverName,
            ip,
            password,
            proxmoxUrl: PROXMOX_CONFIG.host,
            proxmoxUser: proxmoxUserBase,
          });
          await sendMailTemplate(email, vdsTpl);
          console.log(`[PROVISION] VDS welcome email sent to ${email}`);
        } catch (mailError) {
          logError('PROVISION', 'Failed to send VDS email', {
            ...provisionContext(),
            stage: provisionStage,
            vmid,
            stack: mailError.stack,
          });
        }

        sendDiscordLog({
          color: 0x2ecc71,
          title: '🖥️ Создан VDS сервер',
          fields: [
            { name: 'Пользователь', value: email, inline: true },
            { name: 'Сервер', value: serverName, inline: true },
            { name: 'VMID', value: String(vmid), inline: true },
            { name: 'IP', value: ip || 'не получен', inline: true },
            { name: 'Тариф', value: tariffId || 'админ', inline: true },
            ...(totalCost > 0 ? [{ name: 'Стоимость', value: `${totalCost}₽`, inline: true }] : []),
            { name: 'ОС', value: osTemplate || 'не указана', inline: true },
          ],
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        const serverResult = {
          id: vmid,
          identifier: `${vmid}`,
          uuid: `${vmid}`,
          name: serverName,
          node: nodeId,
          ip: ip,
          port: null,
          password: password,
        };

        if (req.user.role !== 'admin' && tariffId) {
          const tariffOnce = db.prepare('SELECT once_per_account FROM plans WHERE id = ?').get(tariffId);
          if (tariffOnce && tariffOnce.once_per_account === 1) {
            db.prepare('INSERT OR IGNORE INTO once_purchases (id, user_id, tariff_id) VALUES (?, ?, ?)').run(genId(), req.user.id, tariffId);
          }
        }

        createProvisionGrant(req.user.id, vmid, 'vps', tariffId);

        res.json({
          success: true,
          server: serverResult,
        });
        return;
      }

      // ========== Игровые и кодинг серверы (Pterodactyl) ==========
      provisionStage = 'ptero_user';
      let pteroUserId;
      try {
        const existing = await ptero('GET', `/users?filter[email]=${encodeURIComponent(email)}`);
        if (existing.data?.length > 0) {
          pteroUserId = existing.data[0].attributes.id;
          console.log(`[PROVISION] Using existing Pterodactyl user ${pteroUserId}`);
        }
      } catch { /* ignore */ }

      if (!pteroUserId) {
        const safeName = (username || 'user').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 28) || 'user';
        const userPassword = req.user.encryptedPassword ? decryptPassword(req.user.encryptedPassword) : null;
        const password = userPassword || genPassword();
        if (!userPassword) {
          console.warn('[PROVISION] No encrypted password for user, generated random password');
          const encrypted = encryptPassword(password);
          db.prepare('UPDATE users SET encryptedPassword = ? WHERE id = ?').run(encrypted, req.user.id);
        }

        const newUser = await ptero('POST', '/users', {
          email,
          username: safeName + '_' + Math.floor(Math.random() * 10000),
          first_name: username || 'User',
          last_name: APP_NAME,
          password,
        });
        pteroUserId = newUser.attributes.id;
        
        const encrypted = encryptPassword(password);
        db.prepare('UPDATE users SET encryptedPassword = ? WHERE email = ?').run(encrypted, email);
        
        try {
          await sendPterodactylCredentials(email, safeName, password);
          console.log(`[PROVISION] Credentials email sent to ${email}`);
        } catch (emailError) {
          console.error('[PROVISION] Failed to send credentials email:', emailError);
        }
      }

      let selectedNodeId = nodeId || DEFAULT_PTERO_NODE_ID;

      provisionStage = 'ptero_egg';
      const nests = await ptero('GET', '/nests');
      const getAllEggs = async () => {
        const eggs = [];
        for (const nest of (nests.data || [])) {
          try {
            const eggsData = await ptero('GET', `/nests/${nest.attributes.id}/eggs?include=variables`);
            for (const egg of (eggsData.data || [])) {
              eggs.push({
                id: egg.attributes.id,
                name: egg.attributes.name,
                docker_image: egg.attributes.docker_image,
                startup: egg.attributes.startup,
                variables: egg.attributes.relationships?.variables?.data || [],
                nest_id: nest.attributes.id
              });
            }
          } catch { /* ignore */ }
        }
        return eggs;
      };

      const allEggs = await getAllEggs();
      if (!allEggs.length) throw new Error('Нет доступных яиц');

      let eggId = null;
      let dockerImage = 'ghcr.io/pterodactyl/yolks:java_17';
      let startup = '';
      let env = {};

      if (serverType === 'coding') {
        const excludeKeywords = [
          'rust', 'rcon', 'minecraft', 'game', 'server', 'java', 'jdk', 'jre',
          'bungee', 'velocity', 'waterfall', 'paper', 'spigot', 'vanilla',
          'forge', 'fabric', 'purpur', 'bukkit', 'bedrock', 'pocketmine', 'nukkit'
        ];
        const codingKeywords = ['node', 'python', 'php', 'go', 'static', 'linux', 'alpine', 'debian', 'ubuntu'];
        
        let bestEgg = null;
        let bestScore = -1;
        
        for (const egg of allEggs) {
          const name = (egg.name || '').toLowerCase();
          let isExcluded = false;
          for (const kw of excludeKeywords) {
            if (name.includes(kw)) { isExcluded = true; break; }
          }
          if (isExcluded) continue;
          
          let score = 0;
          for (const kw of codingKeywords) {
            if (name.includes(kw)) { score += 10; break; }
          }
          const requiredVars = egg.variables.filter(v => v.attributes.required).length;
          score -= requiredVars;
          
          if (score > bestScore) {
            bestScore = score;
            bestEgg = egg;
          }
        }
        
        if (bestEgg) {
          eggId = bestEgg.id;
          dockerImage = bestEgg.docker_image;
          startup = bestEgg.startup || 'tail -f /dev/null';
          if (bestEgg.variables.length) {
            env = {};
            for (const v of bestEgg.variables) {
              let def = v.attributes.default_value || '';
              if (v.attributes.env_variable === 'RCON_PASSWORD' && !def) {
                def = crypto.randomBytes(8).toString('hex');
              }
              env[v.attributes.env_variable] = def;
            }
          }
          console.log(`[PROVISION] Selected coding egg: ${bestEgg.name} (id: ${eggId}) with ${bestEgg.variables.length} variables`);
        } else {
          const fallbackEgg = allEggs[0];
          eggId = fallbackEgg.id;
          dockerImage = fallbackEgg.docker_image;
          startup = 'tail -f /dev/null';
          if (fallbackEgg.variables.length) {
            env = {};
            for (const v of fallbackEgg.variables) {
              let def = v.attributes.default_value || '';
              if (v.attributes.env_variable === 'RCON_PASSWORD' && !def) {
                def = crypto.randomBytes(8).toString('hex');
              }
              env[v.attributes.env_variable] = def;
            }
          }
          console.log(`[PROVISION] Using fallback egg for coding: ${fallbackEgg.name} (id: ${eggId})`);
        }
      } else {
        const effectiveCore = coreName || 'paper';
        const gameKeywords = [effectiveCore.toLowerCase(), 'paper', 'spigot', 'vanilla', 'forge', 'fabric', 'purpur'];
        let bestEgg = null;
        for (const egg of allEggs) {
          const name = (egg.name || '').toLowerCase();
          if (gameKeywords.some(kw => name.includes(kw))) {
            bestEgg = egg;
            break;
          }
        }
        if (!bestEgg && allEggs.length) bestEgg = allEggs[0];
        if (bestEgg) {
          eggId = bestEgg.id;
          dockerImage = bestEgg.docker_image;
          startup = bestEgg.startup || 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}';
          if (bestEgg.variables.length) {
            env = {};
            for (const v of bestEgg.variables) {
              const def = v.attributes.default_value || '';
              env[v.attributes.env_variable] = def;
            }
          }
          console.log(`[PROVISION] Selected game egg: ${bestEgg.name} (id: ${eggId})`);
        } else {
          throw new Error('Нет доступных яиц для создания сервера');
        }
      }

      if (!eggId) throw new Error('Не удалось определить яйцо для создания сервера');

      provisionStage = 'ptero_create';
      const pteroServerPayload = {
        name: serverName,
        user: pteroUserId,
        egg: eggId,
        docker_image: dockerImage,
        startup,
        environment: env,
        limits: { memory: ram, swap: 0, disk, io: 500, cpu: cpu * 100 },
        feature_limits: { databases: 5, backups: 5, allocations: 5 },
      };

      const {
        created,
        nodeId: actualNodeId,
        nodeData,
        recovered,
      } = await createPteroGameServer({
        serverName,
        pteroUserId,
        preferredNodeId: selectedNodeId,
        serverPayload: pteroServerPayload,
      });

      if (recovered) {
        console.log(`[PROVISION] Using recovered Pterodactyl server ${created.attributes.id} for billing`);
      }
      selectedNodeId = actualNodeId;

      if (req.user.role !== 'admin' && tariffId) {
        const tariffOnce = db.prepare('SELECT once_per_account FROM plans WHERE id = ?').get(tariffId);
        if (tariffOnce && tariffOnce.once_per_account === 1) {
          db.prepare('INSERT OR IGNORE INTO once_purchases (id, user_id, tariff_id) VALUES (?, ?, ?)').run(genId(), req.user.id, tariffId);
        }
      }

      db.prepare('UPDATE users SET pterodactylUserId = ? WHERE email = ?').run(pteroUserId, email);

      sendDiscordLog({
        color: 0x2ecc71,
        title: '🕹️ Создан игровой/кодинг сервер',
        fields: [
          { name: 'Пользователь', value: email, inline: true },
          { name: 'Сервер', value: serverName, inline: true },
          { name: 'Тип', value: serverType, inline: true },
          { name: 'Pterodactyl ID', value: String(created.attributes.id), inline: true },
          { name: 'Тариф', value: tariffId || 'админ', inline: true },
          ...(totalCost > 0 ? [{ name: 'Стоимость', value: `${totalCost}₽`, inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      const tariffRow = tariffId ? db.prepare('SELECT name, tier FROM plans WHERE id = ?').get(tariffId) : null;
      const tariffLabel = tariffRow ? `${tariffRow.tier} ${tariffRow.name}` : 'Тариф';
      const panelPassword = req.user.encryptedPassword ? decryptPassword(req.user.encryptedPassword) : null;
      try {
        const gameTpl = buildGameServerReadyEmail(APP_NAME, {
          username,
          serverName,
          tariffName: tariffLabel,
          panelUrl: PTERO_URL,
          email,
          password: panelPassword || '—',
        });
        await sendMailTemplate(email, gameTpl);
      } catch (mailErr) {
        console.error('[PROVISION] Game server email failed:', mailErr.message);
      }

      createProvisionGrant(req.user.id, created.attributes.id, serverType || 'game', tariffId);

      res.json({
        success: true,
        pterodactylUserId: pteroUserId,
        server: {
          id: created.attributes.id,
          identifier: created.attributes.identifier,
          uuid: created.attributes.uuid,
          name: created.attributes.name,
          node: selectedNodeId,
          ip: nodeData ? nodeData.ip : null,
          port: null
        },
      });
    } catch (creationError) {
      // Возвращаем списанные средства при ошибке
      refund();
      throw creationError;
    }
  } catch (e) {
    const errorId = genErrorRef();
    const refunded = wasRefunded || false;

    logError('PROVISION', e.message, {
      ref: errorId,
      ...provisionContext(),
      stage: provisionStage,
      stack: e.stack,
      status: e.status,
      refunded,
    });

    sendDiscordLog({
      color: 0xff0000,
      title: '❌ Ошибка создания сервера',
      fields: [
        { name: 'Код', value: errorId, inline: true },
        { name: 'Пользователь', value: email || '?', inline: true },
        { name: 'Тип', value: serverType || '?', inline: true },
        { name: 'Этап', value: provisionStage, inline: true },
        { name: 'Возврат', value: refunded ? 'Да' : 'Нет', inline: true },
        { name: 'Ошибка', value: String(e.message).substring(0, 900) },
        ...(e.stack ? [{ name: 'Stack', value: String(e.stack).substring(0, 900) }] : []),
      ],
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    const errorMessage = formatPteroUserError(e, { refunded, stage: provisionStage });
    const httpStatus = e.status === 503 || e.status === 504 ? 503 : 500;
    res.status(httpStatus).json({
      success: false,
      error: errorMessage,
      errorId,
      stage: provisionStage,
      refunded,
    });
  }
});

// ══════════════════════════════════════════════════
// PROXMOX OS TEMPLATES API
// ══════════════════════════════════════════════════
app.get('/api/proxmox/templates', authMiddleware, async (req, res) => {
  try {
    const content = await proxmox.request(`/nodes/${PROXMOX_CONFIG.node}/storage/${PROXMOX_CONFIG.storage}/content`, 'GET');
    const templates = content.filter(item => item.content === 'vztmpl' || item.content === 'oci').map(item => ({
      name: item.volid,
      text: item.text,
      type: item.content,
    }));
    res.json(templates);
  } catch (error) {
    console.error('[PROXMOX] Failed to fetch templates:', error);
    res.status(500).json({ error: 'Не удалось загрузить список шаблонов ОС' });
  }
});

// ══════════════════════════════════════════════════
// PROXMOX VPS MANAGEMENT API
// ══════════════════════════════════════════════════
app.get('/api/proxmox/vm/:vmid/status', authMiddleware, async (req, res) => {
  const access = requireVpsAccess(req, res);
  if (!access) return;
  try {
    const status = await proxmox.getLXCStatus(access.vmid);
    res.json(status);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/proxmox/vm/:vmid/start', authMiddleware, sensitiveApiLimiter, async (req, res) => {
  const access = requireVpsAccess(req, res);
  if (!access) return;
  try {
    const upid = await proxmox.startLXC(access.vmid);
    await proxmox.waitForTask(upid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/proxmox/vm/:vmid/stop', authMiddleware, sensitiveApiLimiter, async (req, res) => {
  const access = requireVpsAccess(req, res);
  if (!access) return;
  try {
    const upid = await proxmox.stopLXC(access.vmid);
    await proxmox.waitForTask(upid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/proxmox/vm/:vmid/reboot', authMiddleware, sensitiveApiLimiter, async (req, res) => {
  const access = requireVpsAccess(req, res);
  if (!access) return;
  try {
    const upid = await proxmox.rebootLXC(access.vmid);
    await proxmox.waitForTask(upid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/proxmox/vm/:vmid/info', authMiddleware, async (req, res) => {
  const access = requireVpsAccess(req, res);
  if (!access) return;
  try {
    const info = await proxmox.getLXCInfo(access.vmid);
    res.json(info);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/proxmox/vm/:vmid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const upid = await proxmox.deleteLXC(parseInt(req.params.vmid));
    await proxmox.waitForTask(upid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/vds', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const vdsServers = db.prepare("SELECT * FROM servers WHERE type = 'vps' ORDER BY createdAt DESC").all();
  res.json(vdsServers);
});

// ══════════════════════════════════════════════════
// STATUS PAGE API
// ══════════════════════════════════════════════════
app.get('/api/status', async (req, res) => {
  try {
    const siteStatus = { online: true, message: 'Сайт работает' };

    let panelStatus = { online: false, message: 'Не удалось подключиться' };
    let nodes = [];
    try {
      const nodesData = await ptero('GET', '/nodes?per_page=100');
      panelStatus = { online: true, message: 'Панель доступна' };

      nodes = await Promise.all(
        nodesData.data
          .filter(node => PTERO_PURCHASE_NODE_IDS.includes(node.attributes.id))
          .map(async (node) => {
            const attr = node.attributes;
            const label = attr.id === 1 ? 'Германия 1' : attr.id === 2 ? 'Германия 2' : attr.name;
            return {
              id: attr.id,
              name: label,
              description: attr.description,
              location_id: attr.location_id,
              public: attr.public,
              maintenance_mode: attr.maintenance_mode,
              memory: attr.memory,
              memory_overallocate: attr.memory_overallocate,
              disk: attr.disk,
              disk_overallocate: attr.disk_overallocate,
              servers_count: attr.servers_count,
              created_at: attr.created_at,
              updated_at: attr.updated_at,
              status: attr.maintenance_mode ? 'maintenance' : 'active'
            };
          })
      );
    } catch (error) {
      panelStatus = { online: false, message: error.message || 'Ошибка подключения к Pterodactyl' };
    }

    res.json({
      site: siteStatus,
      panel: panelStatus,
      nodes: nodes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[STATUS] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════
// СТАТИСТИКА ДЛЯ ГЛАВНОЙ СТРАНИЦЫ
// ══════════════════════════════════════════════════
app.get('/api/stats', (req, res) => {
  try {
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE blocked = 0 AND verified = 1').get().count;
    const serversCount = db.prepare("SELECT COUNT(*) as count FROM servers WHERE status = 'active'").get().count;
    let daysWork = 0;
    const firstUser = db.prepare('SELECT MIN(createdAt) as first FROM users').get().first;
    if (firstUser) {
      const start = new Date(firstUser);
      const now = new Date();
      const diffTime = Math.abs(now - start);
      daysWork = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      daysWork = 1;
    }
    res.json({ users: usersCount, servers: serversCount, days: daysWork });
  } catch (error) {
    console.error('[STATS] Error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// ══════════════════════════════════════════════════
// STATIC + SPA FALLBACK
// ══════════════════════════════════════════════════
const distDir = path.resolve(__dirname, 'dist');
const indexFile = path.resolve(distDir, 'index.html');

console.log('[STATIC] distDir:', distDir);
console.log('[STATIC] indexFile:', indexFile);
console.log('[STATIC] exists:', existsSync(indexFile));

const publicDir = path.join(__dirname, 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('[STATIC] Serving public folder:', publicDir);
}

const uploadsDir = path.join(__dirname, 'uploads');
if (existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
  console.log('[STATIC] Serving uploads:', uploadsDir);
}

// Serve built frontend for all non-API routes
const frontendHtml = existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf-8') : null;
if (frontendHtml) {
  console.log('[STATIC] Built frontend loaded, size:', frontendHtml.length);
} else {
  console.warn('[STATIC] index.html not found at', indexFile);
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  if (req.path.includes('.')) return res.status(404).type('text').send('Not found');
  if (frontendHtml) return res.type('html').send(frontendHtml);
  res.status(200).type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${APP_NAME}</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif"><h1>${APP_NAME}</h1><p style="color:#666">Frontend building...</p></body></html>`);
});

const PORT = process.env.PORT || 3000;
const httpServer = app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`🚀 ${APP_NAME} запущен: http://localhost:${PORT}`);
  console.log(`📡 Pterodactyl: ${PTERO_URL}`);
  console.log(`🗄️  SQLite: luminarix.db`);
  console.log(`📝 Логи записываются в access.log`);
  console.log(`═══════════════════════════════════════════\n`);
});
setInterval(() => {}, 60000);