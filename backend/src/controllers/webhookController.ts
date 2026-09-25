import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { paymentProvider } from '../payments';
import * as subscriptionService from '../services/subscriptionService';

/**
 * The one endpoint that is allowed to move a subscription toward "active": every other write to the
 * subscriptions table in this codebase goes through subscriptionService.applyWebhookEvent, and this
 * is its only caller. The signature is verified over the exact raw bytes received (see app.ts's
 * express.json({verify}) which captures req.rawBody) before anything in the body is trusted.
 */
export const handle = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const event = paymentProvider.verifyAndParseWebhook(rawBody, req.headers as Record<string, string | undefined>);
  if (!event) {
    logger.warn({ path: req.path }, 'webhook signature verification failed');
    return res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Signature verification failed.' } });
  }
  await subscriptionService.applyWebhookEvent(
    paymentProvider.name, event.eventId, event.eventType, event.raw, event.providerSubscriptionId, event.period, event.payment,
  );
  // Always 2xx quickly once verified and durably recorded, so the provider does not endlessly retry.
  res.status(200).json({ received: true });
});
