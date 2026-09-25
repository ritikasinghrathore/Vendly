import 'dotenv/config';
import { z } from 'zod';

const boolStr = (fallback: 'true' | 'false') =>
  z.enum(['true', 'false']).default(fallback).transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: boolStr('false'),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ISSUER: z.string().default('vendly-api'),
    JWT_AUDIENCE: z.string().default('vendly-app'),
    ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),

    PAYMENT_PROVIDER: z.enum(['razorpay', 'mock']).default('mock'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    RAZORPAY_PLAN_ID: z.string().optional(),
    MOCK_WEBHOOK_SECRET: z.string().min(16).default('dev-only-mock-webhook-secret'),

    PLAN_AMOUNT_PAISE: z.coerce.number().int().min(100).default(100000),
    SUBSCRIPTION_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),
    TRIAL_DAYS: z.coerce.number().int().min(0).max(60).default(0),
    RUN_JOBS: boolStr('true'),
  })
  .superRefine((v, ctx) => {
    const need = (key: keyof typeof v, msg: string) => {
      if (!v[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key as string], message: msg });
    };
    if (v.PAYMENT_PROVIDER === 'razorpay') {
      need('RAZORPAY_KEY_ID', 'required when PAYMENT_PROVIDER=razorpay');
      need('RAZORPAY_KEY_SECRET', 'required when PAYMENT_PROVIDER=razorpay');
      need('RAZORPAY_WEBHOOK_SECRET', 'required when PAYMENT_PROVIDER=razorpay');
      need('RAZORPAY_PLAN_ID', 'required when PAYMENT_PROVIDER=razorpay (run: npm run razorpay:create-plan)');
    }
    if (v.NODE_ENV === 'production') {
      if (v.PAYMENT_PROVIDER === 'mock') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYMENT_PROVIDER'], message: 'the mock payment provider is not allowed in production' });
      }
      if (/change-me/i.test(v.JWT_ACCESS_SECRET)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_ACCESS_SECRET'], message: 'replace the sample secret with a real random one' });
      }
      if (!v.PUBLIC_BASE_URL.startsWith('https://')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PUBLIC_BASE_URL'], message: 'must be an https:// address in production' });
      }
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail at start-up with a readable list, never run half-configured.
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
