import 'reflect-metadata';
import { createApp } from './app';
import { sequelize } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

async function bootstrap(): Promise<void> {
  await sequelize.authenticate();
  const app = createApp();
  app.listen(env.port, () => {
    logger.info({ port: env.port }, 'Auth service listening');
  });
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Auth service failed to start');
  process.exit(1);
});
