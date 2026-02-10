import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Transaction, Account, Category, Studio, Contractor, LegalEntity } from '../types';
import { useAuth } from './AuthContext';

type DictType = 'categories' | 'contractors' | 'accounts' | 'studios' | 'legal_entities';

interface FinanceContextType {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  studios: Studio[];
  contractors: Contractor[];
  legalEntities: LegalEntity[];
  
  addTransaction: (tx: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  addItem: (type: DictType, data: any) => Promise<void>;
  updateItem: (type: DictType, id: string, data: any) => Promise<void>;
  deleteItem: (type: DictType, id: string) => Promise<void>;

  getAccountBalance: (id: string) => number;
  getTotalBalance: () => number;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const API_URL = '/api';
const POLL_INTERVAL = 5000;

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.id.toString() || ''
  }), [user]);

  const applyData = useCallback((data: any) => {
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
    setLegalEntities(data.legalEntities || []);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!user) return;
    
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/init`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      applyData(data);
      initialLoadDone.current = true;
    } catch (error) {
      console.error("API unavailable", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user, applyData]);

  useEffect(() => {
    if (user) {
      fetchData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      if (initialLoadDone.current) {
        fetchData(true);
      }
    }, POLL_INTERVAL);
    
    return () => clearInterval(interval);
  }, [user, fetchData]);

  const addTransaction = async (txData: Partial<Transaction>) => {
    try {
      const { id, ...payload } = txData; 
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) fetchData(true);
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
      if (res.ok) fetchData(true);
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
      if (res.ok) fetchData(true);
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
        if (res.ok) fetchData(true);
    } catch (error) {
        console.error(`Error adding ${type}`, error);
    }
  };

  const updateItem = async (type: string, id: string, data: any) => {
    try {
      const res = await fetch(`${API_URL}/${type}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (res.ok) fetchData(true);
    } catch (error) {
      console.error(`Error updating ${type}`, error);
    }
  };

  const deleteItem = async (type: string, id: string) => {
    try {
        const res = await fetch(`${API_URL}/${type}/${id}`, { 
            method: 'DELETE',
            headers: getHeaders()
        });
        if (res.ok) fetchData(true);
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

  const refreshData = () => fetchData(true);

  return (
    <FinanceContext.Provider value={{
      transactions,
      accounts,
      categories,
      studios,
      contractors,
      legalEntities,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addItem,
      updateItem,
      deleteItem,
      getAccountBalance,
      getTotalBalance,
      isLoading,
      refreshData
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
