import { env } from '../config/env';
import type { PaymentProvider } from './types';
import { mockProvider } from './mock/provider';
import { razorpayProvider } from './razorpay/provider';

export const paymentProvider: PaymentProvider = env.PAYMENT_PROVIDER === 'razorpay' ? razorpayProvider : mockProvider;
export type { PaymentProvider, NormalizedEvent, CheckoutResult } from './types';
