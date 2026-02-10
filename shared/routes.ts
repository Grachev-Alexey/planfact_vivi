import { z } from 'zod';
import { 
  insertStudioSchema, 
  insertAccountSchema, 
  insertCategorySchema, 
  insertTransactionSchema,
  studios,
  accounts,
  categories,
  transactions
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  studios: {
    list: {
      method: 'GET' as const,
      path: '/api/studios' as const,
      responses: {
        200: z.array(z.custom<typeof studios.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/studios' as const,
      input: insertStudioSchema,
      responses: {
        201: z.custom<typeof studios.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/studios/:id' as const,
      input: insertStudioSchema.partial(),
      responses: {
        200: z.custom<typeof studios.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/studios/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  accounts: {
    list: {
      method: 'GET' as const,
      path: '/api/accounts' as const,
      responses: {
        200: z.array(z.custom<typeof accounts.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/accounts' as const,
      input: insertAccountSchema,
      responses: {
        201: z.custom<typeof accounts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/accounts/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories' as const,
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories' as const,
      input: insertCategorySchema,
      responses: {
        201: z.custom<typeof categories.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/categories/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions' as const,
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        studioId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/transactions' as const,
      input: insertTransactionSchema,
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/transactions/:id' as const,
      input: insertTransactionSchema.partial(),
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/transactions/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  reports: {
    cashflow: {
      method: 'GET' as const,
      path: '/api/reports/cashflow' as const,
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.any(), // Type defined in schema.ts
      },
    },
    pnl: {
      method: 'GET' as const,
      path: '/api/reports/pnl' as const,
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.any(), // Type defined in schema.ts
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
