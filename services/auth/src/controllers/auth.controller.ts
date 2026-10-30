import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { loginSchema, refreshSchema, registerSchema } from '../dtos/auth.dto';
import { AppError } from '../utils/app-error';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = registerSchema.parse(req.body);
      const result = await this.authService.register(dto);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = loginSchema.parse(req.body);
      const result = await this.authService.login(dto);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = refreshSchema.parse(req.body);
      const tokens = await this.authService.refresh(dto.refreshToken);
      res.status(200).json({ data: { tokens } });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = refreshSchema.parse(req.body);
      await this.authService.logout(dto.refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }
      const user = await this.authService.me(userId);
      res.status(200).json({ data: { user } });
    } catch (err) {
      next(err);
    }
  };
}
