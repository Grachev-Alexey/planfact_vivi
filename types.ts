export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';

export interface Studio {
  id: string;
  name: string;
  address?: string;
  color?: string;
}

export interface LegalEntity {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  address?: string;
  description?: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'cash' | 'card' | 'account';
  currency: string;
  initialBalance?: number;
  legalEntityId?: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  parentId?: string;
  icon?: string;
}

export interface Contractor {
  id: string;
  name: string;
  inn?: string;
  description?: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  studioId?: string;
  description: string;
  contractorId?: string;
  confirmed?: boolean;
  accrualDate?: string;
  yclientsStatus?: string | null;
  yclientsRecordId?: string | null;
  yclientsData?: string | null;
  yclientsCheckedAt?: string | null;
}
