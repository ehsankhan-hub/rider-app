import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

  router.post('/register', limiter, controller.register);
  router.post('/login', limiter, controller.login);
  router.post('/refresh', limiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authMiddleware, controller.me);

  return router;
}
