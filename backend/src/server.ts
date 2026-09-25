import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { pool } from './db/pool';
import { migrate } from './db/migrate';
import { startExpirySweeper } from './jobs/expireSubscriptions';

async function main() {
  await migrate();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Vendly API listening on port ${env.PORT} (${env.NODE_ENV}, payments: ${env.PAYMENT_PROVIDER})`);
  });

  const stopSweeper = env.RUN_JOBS ? startExpirySweeper() : () => {};

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopSweeper();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // force-exit if something hangs
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'failed to start Vendly API');
  process.exit(1);
});
