export const formatCurrency = (amount: number, currency = 'RUB'): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr);
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'income': return 'text-emerald-600 bg-emerald-50';
    case 'expense': return 'text-rose-600 bg-rose-50';
    default: return 'text-slate-600 bg-slate-50';
  }
};
