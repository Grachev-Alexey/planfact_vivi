const db = require('../db.cjs');

const actionLabels = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  login: 'Вход',
  batch_update: 'Массовое обновление',
  batch_delete: 'Массовое удаление',
  distribute: 'Распределение по студиям',
  cleanup: 'Очистка',
  restore: 'Восстановление',
  trash: 'В корзину',
  import: 'Импорт',
};

const entityLabels = {
  transaction: 'Операция',
  user: 'Пользователь',
  auth: 'Авторизация',
  categories: 'Статья',
  contractors: 'Контрагент',
  accounts: 'Счет',
  studios: 'Студия',
  legal_entities: 'Юрлицо',
  master_income: 'Поступление мастера',
  master_shift: 'Смена мастера',
  payment_request: 'Запрос выплаты',
};

const typeLabels = {
  income: 'поступление',
  expense: 'выплата',
  transfer: 'перемещение'
};

const formatDetails = (action, entityType, details) => {
  if (entityType === 'auth') return 'Вход в систему';

  const entityLabel = entityLabels[entityType] || entityType;

  if (typeof details === 'object' && details !== null) {
    const parts = [];
    if (details.amount !== undefined) parts.push(`сумма: ${details.amount}`);
    if (details.paymentType) parts.push(`тип оплаты: ${details.paymentType}`);
    if (details.clientName) parts.push(`клиент: ${details.clientName}`);
    if (details.name) parts.push(details.name);
    if (parts.length > 0) return parts.join(', ');
    return JSON.stringify(details);
  }

  if (typeof details === 'string' && details.trim()) return details.trim();

  const actionLabel = (actionLabels[action] || action).toLowerCase();
  return `${actionLabel} — ${entityLabel.toLowerCase()}`;
};

const logAction = async (userId, action, entityType, entityId, details) => {
  try {
    let username = 'Система';
    if (userId) {
      const u = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
      if (u.rows.length > 0) username = u.rows[0].username;
    }

    const russianAction = actionLabels[action] || action;
    const russianEntity = entityLabels[entityType] || entityType;
    const russianDetails = formatDetails(action, entityType, details);

    await db.query(
      'INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId || null, username, russianAction, russianEntity, entityId?.toString(), russianDetails]
    );
  } catch (err) {
    console.error('Logging error:', err);
  }
};

module.exports = { logAction };
