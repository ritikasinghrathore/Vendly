import { logger } from '../utils/logger';
import * as subscriptionService from '../services/subscriptionService';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly is plenty: access is judged from access_until on every request regardless

export function startExpirySweeper(): () => void {
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    try {
      const n = await subscriptionService.sweepExpired();
      if (n > 0) logger.info({ count: n }, 'subscription expiry sweep');
    } catch (err) {
      logger.error({ err }, 'subscription expiry sweep failed');
    }
  };
  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
