import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { UserDao } from './dao/user.dao';
import { RefreshTokenDao } from './dao/refresh-token.dao';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { createAuthRouter } from './routes/auth.routes';
import { errorMiddleware } from './middlewares/error.middleware';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  const authService = new AuthService(new UserDao(), new RefreshTokenDao());
  const authController = new AuthController(authService);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth' });
  });
  app.use('/api/v1/auth', createAuthRouter(authController));
  app.use(errorMiddleware);
  return app;
}
