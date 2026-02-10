import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertStudioSchema, insertAccountSchema, insertCategorySchema, insertTransactionSchema } from "@shared/schema";

async function seedDatabase() {
  const studios = await storage.getStudios();
  if (studios.length === 0) {
    console.log("Seeding database...");
    
    // Create Studio
    const studio = await storage.createStudio({
      name: "ViVi Moscow",
      address: "Tverskaya 1",
    });

    // Create Accounts
    const cash = await storage.createAccount({
      name: "Касса (Наличные)",
      type: "cash",
      currency: "RUB",
      balance: "50000.00",
      studioId: studio.id,
    });
    
    const bank = await storage.createAccount({
      name: "Сбербанк (Р/С)",
      type: "bank_account",
      currency: "RUB",
      balance: "150000.00",
      studioId: studio.id,
    });

    // Create Categories
    const incServices = await storage.createCategory({ name: "Выручка (Услуги)", type: "income", isSystem: true });
    const incProducts = await storage.createCategory({ name: "Выручка (Товары)", type: "income", isSystem: true });
    
    const expRent = await storage.createCategory({ name: "Аренда", type: "expense", isSystem: true });
    const expSalary = await storage.createCategory({ name: "Зарплата", type: "expense", isSystem: true });
    const expMarketing = await storage.createCategory({ name: "Маркетинг", type: "expense" });
    const expConsumables = await storage.createCategory({ name: "Расходники", type: "expense" });

    // Create Transactions
    await storage.createTransaction({
      date: new Date(),
      amount: "5000.00",
      type: "income",
      description: "Лазерная эпиляция (Голени)",
      accountId: cash.id,
      categoryId: incServices.id,
      studioId: studio.id,
    });

    await storage.createTransaction({
      date: new Date(Date.now() - 86400000), // Yesterday
      amount: "12000.00",
      type: "income",
      description: "Абонемент 5 процедур",
      accountId: bank.id,
      categoryId: incServices.id,
      studioId: studio.id,
    });

    await storage.createTransaction({
      date: new Date(Date.now() - 172800000), // 2 days ago
      amount: "50000.00",
      type: "expense",
      description: "Аренда за Март",
      accountId: bank.id,
      categoryId: expRent.id,
      studioId: studio.id,
    });

    console.log("Database seeded!");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // Seed DB
  await seedDatabase();

  // Studios
  app.get(api.studios.list.path, async (req, res) => {
    const items = await storage.getStudios();
    res.json(items);
  });

  app.post(api.studios.create.path, async (req, res) => {
    try {
      const input = api.studios.create.input.parse(req.body);
      const item = await storage.createStudio(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.studios.update.path, async (req, res) => {
    try {
      const input = api.studios.update.input.parse(req.body);
      const item = await storage.updateStudio(Number(req.params.id), input);
      if (!item) return res.status(404).json({ message: "Studio not found" });
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.studios.delete.path, async (req, res) => {
    await storage.deleteStudio(Number(req.params.id));
    res.status(204).send();
  });

  // Accounts
  app.get(api.accounts.list.path, async (req, res) => {
    const items = await storage.getAccounts();
    res.json(items);
  });

  app.post(api.accounts.create.path, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const item = await storage.createAccount(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.accounts.delete.path, async (req, res) => {
    await storage.deleteAccount(Number(req.params.id));
    res.status(204).send();
  });

  // Categories
  app.get(api.categories.list.path, async (req, res) => {
    const items = await storage.getCategories();
    res.json(items);
  });

  app.post(api.categories.create.path, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const item = await storage.createCategory(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.categories.delete.path, async (req, res) => {
    await storage.deleteCategory(Number(req.params.id));
    res.status(204).send();
  });

  // Transactions
  app.get(api.transactions.list.path, async (req, res) => {
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      studioId: req.query.studioId ? Number(req.query.studioId) : undefined,
    };
    const items = await storage.getTransactions(filters);
    res.json(items);
  });

  app.post(api.transactions.create.path, async (req, res) => {
    try {
      const input = api.transactions.create.input.parse(req.body);
      // Inject current user ID if logged in (optional for MVP)
      // input.createdById = req.user?.id; 
      const item = await storage.createTransaction(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.transactions.update.path, async (req, res) => {
    try {
      const input = api.transactions.update.input.parse(req.body);
      const item = await storage.updateTransaction(Number(req.params.id), input);
      if (!item) return res.status(404).json({ message: "Transaction not found" });
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.transactions.delete.path, async (req, res) => {
    await storage.deleteTransaction(Number(req.params.id));
    res.status(204).send();
  });

  // Reports (Placeholder)
  app.get(api.reports.cashflow.path, async (req, res) => {
    res.json([]);
  });

  app.get(api.reports.pnl.path, async (req, res) => {
    res.json([]);
  });

  return httpServer;
}
