export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Studio {
  id: string;
  name: string;
  address: string;
  color: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'cash' | 'card' | 'account';
  currency: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  parentId?: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO Date
  amount: number;
  type: TransactionType;
  accountId: string;
  toAccountId?: string; // For transfers
  categoryId?: string;
  studioId?: string; // Which studio this belongs to
  description: string;
  contractor?: string;
}

export interface KPI {
  revenue: number;
  expenses: number;
  profit: number;
  balance: number;
  margin: number;
}
