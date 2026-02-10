export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Studio {
  id: string;
  name: string;
  address?: string;
  color?: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'cash' | 'card' | 'account';
  currency: string;
  initialBalance?: number;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  parentId?: string;
  icon?: string;
}

export interface Contractor {
  id: string;
  name: string;
  inn?: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO Date
  amount: number;
  type: TransactionType;
  accountId: string;
  toAccountId?: string; // For transfers
  categoryId?: string;
  studioId?: string;
  description: string;
  contractorId?: string;
  projectId?: string;
}
