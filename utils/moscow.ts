export function getMoscowNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
}

export function getMoscowToday(): string {
  const m = getMoscowNow();
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, '0');
  const d = String(m.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

export function getMoscowYear(): number {
  return getMoscowNow().getFullYear();
}

export function getMoscowMonth(): number {
  return getMoscowNow().getMonth();
}
