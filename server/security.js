/**
 * Серверная валидация входных данных (защита от null/injection/XSS в биллинге).
 */

import crypto from 'crypto';

const UNSAFE_TEXT_PATTERN = /[<>'"\\/?,;&|$`(){}\[\]\x00-\x1f]/;

/** Только латиница, цифры, дефис; 3–32 символа */
export const SERVER_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-]{2,31}$/;

export function validateServerName(name) {
  const raw = String(name ?? '').trim();
  if (!raw) return { ok: false, error: 'Укажите название сервера' };
  if (raw.length < 3 || raw.length > 32) {
    return { ok: false, error: 'Название сервера: от 3 до 32 символов' };
  }
  if (!SERVER_NAME_REGEX.test(raw)) {
    return { ok: false, error: 'Название сервера: только латинские буквы, цифры и дефис (без пробелов и спецсимволов)' };
  }
  return { ok: true, value: raw };
}

export function validatePlanLabel(label, fieldName = 'Название') {
  const raw = String(label ?? '').trim();
  if (!raw) return { ok: false, error: `${fieldName} обязательно` };
  if (raw.length > 64) return { ok: false, error: `${fieldName}: максимум 64 символа` };
  if (UNSAFE_TEXT_PATTERN.test(raw)) {
    return { ok: false, error: `${fieldName}: недопустимые символы (< > / \\ ? и др.)` };
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9\s._\-+]+$/.test(raw)) {
    return { ok: false, error: `${fieldName}: разрешены только буквы, цифры, пробел, . _ - +` };
  }
  return { ok: true, value: raw };
}

export function parsePositiveInt(value, fieldName, { min = 1, max = 1_000_000 } = {}) {
  if (value === null || value === undefined || value === '') {
    return { ok: false, error: `${fieldName}: значение обязательно` };
  }
  if (typeof value === 'string' && value.trim().toLowerCase() === 'null') {
    return { ok: false, error: `${fieldName}: некорректное значение` };
  }
  const n = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: `${fieldName}: укажите целое число` };
  }
  if (n < min || n > max) {
    return { ok: false, error: `${fieldName}: от ${min} до ${max}` };
  }
  return { ok: true, value: n };
}

export function parsePrice(value) {
  if (value === null || value === undefined || value === '') {
    return { ok: false, error: 'Цена обязательна' };
  }
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(n)) return { ok: false, error: 'Некорректная цена' };
  if (n < 0 || n > 10_000_000) return { ok: false, error: 'Цена вне допустимого диапазона' };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function validatePlanPayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.name !== undefined) {
    const name = validatePlanLabel(body.name, 'Название тарифа');
    if (!name.ok) errors.push(name.error);
    else out.name = name.value;
  }
  if (!partial || body.tier !== undefined) {
    const tier = validatePlanLabel(body.tier, 'Уровень тарифа');
    if (!tier.ok) errors.push(tier.error);
    else out.tier = tier.value;
  }
  if (!partial || body.price !== undefined) {
    const price = parsePrice(body.price);
    if (!price.ok) errors.push(price.error);
    else out.price = price.value;
  }
  if (!partial || body.ram !== undefined) {
    const ram = parsePositiveInt(body.ram, 'RAM (МБ)', { min: 128, max: 1_048_576 });
    if (!ram.ok) errors.push(ram.error);
    else out.ram = ram.value;
  }
  if (!partial || body.cores !== undefined) {
    const cores = parsePositiveInt(body.cores, 'CPU', { min: 1, max: 128 });
    if (!cores.ok) errors.push(cores.error);
    else out.cores = cores.value;
  }
  if (!partial || body.disk !== undefined) {
    const disk = parsePositiveInt(body.disk, 'Диск (МБ)', { min: 512, max: 10_485_760 });
    if (!disk.ok) errors.push(disk.error);
    else out.disk = disk.value;
  }

  if (body.type !== undefined) {
    const t = String(body.type || 'game');
    if (!['game', 'coding', 'vps'].includes(t)) errors.push('Некорректный тип тарифа');
    else out.type = t;
  }

  if (body.node_id !== undefined && body.node_id !== null && body.node_id !== '') {
    const node = parsePositiveInt(body.node_id, 'Нода', { min: 1, max: 9999 });
    if (!node.ok) errors.push(node.error);
    else out.node_id = node.value;
  } else if (body.node_id === null || body.node_id === '') {
    out.node_id = null;
  }

  if (errors.length) return { ok: false, error: errors[0], errors };
  return { ok: true, value: out };
}

export function validatePlanRecord(plan) {
  if (!plan) return { ok: false, error: 'Тариф не найден' };
  return validatePlanPayload(
    { name: plan.name, tier: plan.tier, price: plan.price, ram: plan.ram, cores: plan.cores, disk: plan.disk },
    { partial: false },
  );
}

export function sanitizeReviewText(text) {
  let raw = String(text ?? '').trim();
  raw = raw.replace(/\0/g, '');
  raw = raw.replace(/<[^>]*>/g, '');
  if (raw.length > 2000) raw = raw.slice(0, 2000);
  return raw;
}

export function validateReviewInput(rating, text) {
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5 || !Number.isInteger(r)) {
    return { ok: false, error: 'Оценка должна быть от 1 до 5' };
  }
  const clean = sanitizeReviewText(text);
  if (clean.length < 3) return { ok: false, error: 'Текст отзыва: минимум 3 символа' };
  if (/[<>]|javascript:/i.test(clean)) {
    return { ok: false, error: 'Отзыв содержит недопустимые символы' };
  }
  return { ok: true, rating: r, text: clean };
}

export function sanitizeTicketText(text, maxLen = 10000) {
  let raw = String(text ?? '').trim();
  raw = raw.replace(/\0/g, '');
  if (raw.length > maxLen) raw = raw.slice(0, maxLen);
  return raw;
}

export function validateTicketSubject(subject) {
  const raw = sanitizeTicketText(subject, 200);
  if (raw.length < 2) return { ok: false, error: 'Тема слишком короткая' };
  if (UNSAFE_TEXT_PATTERN.test(raw)) return { ok: false, error: 'Тема содержит недопустимые символы' };
  return { ok: true, value: raw };
}

export function validateBanReason(reason) {
  const raw = sanitizeTicketText(reason, 500).trim();
  if (raw.length < 3) return { ok: false, error: 'Причина блокировки: минимум 3 символа' };
  if (UNSAFE_TEXT_PATTERN.test(raw)) return { ok: false, error: 'Причина содержит недопустимые символы' };
  return { ok: true, value: raw };
}

const USERNAME_REGEX = /^[a-zA-Zа-яА-ЯёЁ0-9_.#-]{3,30}$/;
const VALID_ROLES = ['user', 'support', 'admin'];
const TICKET_STATUSES = ['open', 'answered', 'closed'];

export function parseMoneyAmount(value, { min = 1, max = 100_000 } = {}) {
  if (value === null || value === undefined || value === '') {
    return { ok: false, error: 'Укажите сумму' };
  }
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(n)) return { ok: false, error: 'Некорректная сумма' };
  if (n < min || n > max) return { ok: false, error: `Сумма: от ${min} до ${max} ₽` };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function parseRenewMonths(value) {
  return parsePositiveInt(value ?? 1, 'Срок продления', { min: 1, max: 36 });
}

/** Скидка 20% при продлении на 12 месяцев */
export function getRenewalDiscountRate(months) {
  return months === 12 ? 0.2 : 0;
}

export function calcRenewalCost(unitPrice, months) {
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price < 0) return 0;
  const total = price * months;
  const discount = getRenewalDiscountRate(months);
  return Math.round(total * (1 - discount) * 100) / 100;
}

export function validateUsername(username) {
  const raw = String(username ?? '').trim();
  if (!USERNAME_REGEX.test(raw)) {
    return { ok: false, error: 'Имя: 3–30 символов, буквы, цифры, _, ., -, #' };
  }
  if (UNSAFE_TEXT_PATTERN.test(raw)) {
    return { ok: false, error: 'Имя содержит недопустимые символы' };
  }
  return { ok: true, value: raw };
}

export function validateEmail(email) {
  const raw = String(email ?? '').trim().toLowerCase();
  if (!raw || raw.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, error: 'Некорректный email' };
  }
  return { ok: true, value: raw };
}

export function validateRoleForActor(actorRole, role) {
  const r = String(role ?? '').trim();
  if (!VALID_ROLES.includes(r)) return { ok: false, error: 'Недопустимая роль' };
  if (actorRole !== 'admin' && r === 'admin') {
    return { ok: false, error: 'Недостаточно прав для назначения роли admin' };
  }
  return { ok: true, value: r };
}

export function parseBalance(value) {
  return parseMoneyAmount(value, { min: 0, max: 10_000_000 });
}

export function isStaffUser(user) {
  return user?.role === 'admin' || user?.role === 'support';
}

export function isAdminUser(user) {
  return user?.role === 'admin';
}

export function canAccessServer(server, user) {
  if (!server || !user) return false;
  if (server.userId === user.id) return true;
  return isAdminUser(user);
}

export function canAccessTicket(ticket, user) {
  if (!ticket || !user) return false;
  if (ticket.userId === user.id) return true;
  return isStaffUser(user);
}

export function validateTicketStatus(status, isStaff) {
  const s = String(status ?? '').trim();
  if (!TICKET_STATUSES.includes(s)) return { ok: false, error: 'Недопустимый статус тикета' };
  if (!isStaff && s !== 'closed') {
    return { ok: false, error: 'Пользователь может только закрыть тикет' };
  }
  return { ok: true, value: s };
}

export function safeTimingEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
