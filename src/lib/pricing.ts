/** Скидка 20% при продлении на 12 месяцев */
export function getRenewalDiscountRate(months: number): number {
  return months === 12 ? 0.2 : 0;
}

export function calcRenewalCost(unitPrice: number, months: number): number {
  const total = unitPrice * months;
  const discount = getRenewalDiscountRate(months);
  return Math.round(total * (1 - discount) * 100) / 100;
}
