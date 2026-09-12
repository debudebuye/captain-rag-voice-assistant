import { env } from './config/env';
import { createApp } from './app';
import { logger } from './shared/logger';

async function main(): Promise<void> {
  const app = createApp();

  app.listen(env.PORT, env.HOST, () => {
    logger.info(
      { port: env.PORT, host: env.HOST, env: env.NODE_ENV },
      'Server started',
    );
  });
}

main().catch((err) => {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
});