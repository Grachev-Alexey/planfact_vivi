function getMoscowNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
}

function getMoscowToday() {
  const m = getMoscowNow();
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, '0');
  const d = String(m.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function getMoscowISO() {
  const m = getMoscowNow();
  return m.toISOString();
}

function toMoscowDateString(date) {
  const d = new Date(date);
  const m = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, '0');
  const day = String(m.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

module.exports = { getMoscowNow, getMoscowToday, getMoscowISO, toMoscowDateString };
