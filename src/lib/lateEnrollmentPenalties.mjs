export const PART_B_STANDARD_PREMIUMS = Object.freeze({ 2026: 202.90, 2027: 209.40 });
export const PART_D_BASE_PREMIUMS = Object.freeze({ 2026: 38.99, 2027: 41.33 });

export function estimatePartBPenalty(monthsLate, year = 2027) {
  const months = Number(monthsLate);
  const premium = PART_B_STANDARD_PREMIUMS[year];
  if (!Number.isSafeInteger(months) || months < 0 || !premium) {
    return { premium: null, penalty: null, total: null };
  }
  const fullPeriods = Math.floor(months / 12);
  const penaltyCents = Math.round(Math.round(premium * 100) * 0.1 * fullPeriods);
  const penalty = penaltyCents / 100;
  const total = Math.round((Math.round(premium * 100) + penaltyCents) / 10) / 10;
  return { premium, penalty, total, fullPeriods };
}

export function estimatePartDPenalty(fullUncoveredMonths, year = 2027) {
  const months = Number(fullUncoveredMonths);
  const basePremium = PART_D_BASE_PREMIUMS[year];
  if (!Number.isSafeInteger(months) || months < 0 || !basePremium) return null;
  const amountBeforeRounding = basePremium * 0.01 * months;
  return Math.round(amountBeforeRounding * 10) / 10;
}
