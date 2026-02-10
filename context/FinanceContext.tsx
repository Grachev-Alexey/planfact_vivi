import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Transaction, Account, Category, Studio } from '../types';

interface FinanceContextType {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  studios: Studio[];
  addTransaction: (tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  getAccountBalance: (id: string) => number;
  getTotalBalance: () => number;
  isLoading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const API_URL = 'http://localhost:3001/api'; // Adjust if needed

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/init`);
      const data = await res.json();
      
      // Map DB fields to frontend types if casing differs (snake_case -> camelCase)
      // Postgres returns snake_case by default usually, but let's handle basic mapping if needed.
      // Assuming server returns matches or we map here.
      // For now, let's assume the frontend types match or we adapt manually.
      // Quick adapter for DB snake_case response:
      
      const mapTransaction = (t: any): Transaction => ({
        ...t,
        accountId: t.account_id,
        categoryId: t.category_id,
        studioId: t.studio_id,
        amount: Number(t.amount) // Ensure number
      });
      
      const mapAccount = (a: any): Account => ({
        ...a,
        balance: Number(a.balance)
      });

      setTransactions(data.transactions.map(mapTransaction));
      setAccounts(data.accounts.map(mapAccount));
      setCategories(data.categories);
      setStudios(data.studios);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addTransaction = async (txData: Partial<Transaction>) => {
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      
      if (res.ok) {
        // Refresh all data to get updated balances and sorting
        fetchData();
      }
    } catch (error) {
      console.error("Error adding transaction", error);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting transaction", error);
    }
  };

  const getAccountBalance = (id: string) => {
    return accounts.find(a => a.id === id)?.balance || 0;
  };

  const getTotalBalance = () => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0);
  };

  return (
    <FinanceContext.Provider value={{
      transactions,
      accounts,
      categories,
      studios,
      addTransaction,
      deleteTransaction,
      getAccountBalance,
      getTotalBalance,
      isLoading
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
