import { pgTable, text, serial, integer, boolean, timestamp, date, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

// Export users table from auth for compatibility
export { users } from "./models/auth";

// === TABLE DEFINITIONS ===

// Studios (Studii) - e.g. "ViVi Moscow", "ViVi St. Petersburg"
export const studios = pgTable("studios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Accounts (Scheta) - e.g. "Cash", "Sberbank", "Tinkoff"
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'cash', 'card', 'bank_account'
  currency: text("currency").default("RUB").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0").notNull(), // Current balance
  studioId: integer("studio_id").references(() => studios.id), // Optional: account belongs to a specific studio
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories (Stat'i) - e.g. "Revenue", "Rent", "Salaries"
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income', 'expense'
  parentId: integer("parent_id"), // For nested categories
  isSystem: boolean("is_system").default(false), // System categories cannot be deleted
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions (Operacii)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'income', 'expense', 'transfer'
  description: text("description"),
  
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  toAccountId: integer("to_account_id").references(() => accounts.id), // For transfers
  
  categoryId: integer("category_id").references(() => categories.id), // Null for transfers
  studioId: integer("studio_id").references(() => studios.id), // Which studio this transaction belongs to
  
  createdById: text("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const studiosRelations = relations(studios, ({ many }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  studio: one(studios, {
    fields: [accounts.studioId],
    references: [studios.id],
  }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parent_child",
  }),
  children: many(categories, {
    relationName: "parent_child",
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  toAccount: one(accounts, {
    fields: [transactions.toAccountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  studio: one(studios, {
    fields: [transactions.studioId],
    references: [studios.id],
  }),
  createdBy: one(users, {
    fields: [transactions.createdById],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertStudioSchema = createInsertSchema(studios).omit({ id: true, createdAt: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Studio = typeof studios.$inferSelect;
export type InsertStudio = z.infer<typeof insertStudioSchema>;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Request types
export type CreateTransactionRequest = InsertTransaction;
export type UpdateTransactionRequest = Partial<InsertTransaction>;

// Response types with relations
export type TransactionWithDetails = Transaction & {
  category?: Category | null;
  account?: Account | null;
  studio?: Studio | null;
};

// Report types
export interface CashflowReport {
  period: string; // "Jan 2024"
  income: number;
  expense: number;
  balance: number;
}

export interface PnlReport {
  category: string;
  amount: number;
  type: 'income' | 'expense';
  children?: PnlReport[];
}
