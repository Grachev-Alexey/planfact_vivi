import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Transaction, Account, Category, Studio, Contractor, Project } from '../types';
import { useAuth } from './AuthContext';

interface FinanceContextType {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  studios: Studio[];
  contractors: Contractor[];
  projects: Project[];
  
  addTransaction: (tx: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  addItem: (type: 'categories' | 'contractors' | 'projects' | 'accounts' | 'studios', data: any) => Promise<void>;
  deleteItem: (type: 'categories' | 'contractors' | 'projects' | 'accounts' | 'studios', id: string) => Promise<void>;

  getAccountBalance: (id: string) => number;
  getTotalBalance: () => number;
  isLoading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const API_URL = 'http://localhost:3001/api';

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to get headers with Auth ID
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.id.toString() || ''
  });

  const fetchData = async () => {
    // Only fetch if authenticated (handled by route protection usually, but good safeguard)
    if (!user) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/init`);
      if (!res.ok) throw new Error('Failed to fetch data');
      
      const data = await res.json();
      
      const mapTransaction = (t: any): Transaction => ({
        ...t,
        amount: Number(t.amount)
      });
      
      const mapAccount = (a: any): Account => ({
        ...a,
        balance: Number(a.balance)
      });

      setTransactions(data.transactions.map(mapTransaction));
      setAccounts(data.accounts.map(mapAccount));
      setCategories(data.categories);
      setStudios(data.studios);
      setContractors(data.contractors);
      setProjects(data.projects);
    } catch (error) {
      console.error("API unavailable", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const addTransaction = async (txData: Partial<Transaction>) => {
    try {
      const { id, ...payload } = txData; 
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Error adding transaction", error);
    }
  };

  const updateTransaction = async (id: string, txData: Partial<Transaction>) => {
    try {
      const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(txData)
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Error updating transaction", error);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/transactions/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Error deleting transaction", error);
    }
  };

  const addItem = async (type: string, data: any) => {
    try {
        const res = await fetch(`${API_URL}/${type}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (res.ok) fetchData();
    } catch (error) {
        console.error(`Error adding ${type}`, error);
    }
  };

  const deleteItem = async (type: string, id: string) => {
    try {
        const res = await fetch(`${API_URL}/${type}/${id}`, { 
            method: 'DELETE',
            headers: getHeaders()
        });
        if (res.ok) fetchData();
    } catch (error) {
        console.error(`Error deleting from ${type}`, error);
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
      contractors,
      projects,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addItem,
      deleteItem,
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