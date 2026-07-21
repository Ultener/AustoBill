/** Клиентская валидация (дублирует серверные правила для UX). */

export const SERVER_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-]{2,31}$/;

const UNSAFE_TEXT = /[<>'"\\/?,;&|$`(){}\[\]]/;

export function validateServerNameClient(name: string): string | null {
  const raw = name.trim();
  if (!SERVER_NAME_REGEX.test(raw)) {
    return 'Название: только латинские буквы, цифры и дефис (3–32 символа)';
  }
  return null;
}

export function validatePlanNameClient(name: string, label = 'Название'): string | null {
  const raw = name.trim();
  if (!raw) return `${label} обязательно`;
  if (UNSAFE_TEXT.test(raw)) return `${label}: недопустимые символы`;
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9\s._\-+]+$/.test(raw)) return `${label}: недопустимые символы`;
  return null;
}

export function validatePlanSpecsClient(ram: string, cores: string, disk: string, price: string): string | null {
  const r = parseInt(ram, 10);
  const c = parseInt(cores, 10);
  const d = parseInt(disk, 10);
  const p = parseFloat(price);
  if (!Number.isFinite(r) || r < 128) return 'RAM: минимум 128 МБ';
  if (!Number.isFinite(c) || c < 1) return 'CPU: минимум 1';
  if (!Number.isFinite(d) || d < 512) return 'Диск: минимум 512 МБ';
  if (!Number.isFinite(p) || p < 0) return 'Укажите корректную цену';
  return null;
}
