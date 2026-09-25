export interface CheckoutResult {
  checkoutUrl: string;
  providerCustomerId: string;
  providerSubscriptionId: string;
}

/** What a webhook told us, in a shape that no longer depends on which provider sent it. */
export interface NormalizedEvent {
  eventId: string;
  eventType: string;                 // e.g. 'subscription.activated', 'subscription.charged'
  providerSubscriptionId: string | null;
  period: { start: Date; end: Date } | null;
  payment: { providerPaymentId: string; amountPaise: number; status: 'captured' | 'failed' | 'authorized'; method: string | null } | null;
  raw: unknown;
}

export interface PaymentProvider {
  name: 'mock' | 'razorpay';
  createSubscriptionCheckout(input: {
    shopId: string; userId: string; userEmail: string; userName: string; userPhone?: string | null;
  }): Promise<CheckoutResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  /** Verifies the signature over the RAW body and, only if valid, returns the normalized event. Returns null on a bad signature. */
  verifyAndParseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedEvent | null;
}
