import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WalletService } from '../services/wallet.service';
import { AppError } from '../utils/app-error';

const topUpSchema = z.object({
  amount: z.number().positive().max(500),
});

export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      const data = await this.walletService.getForUser(req.userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  topUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      const dto = topUpSchema.parse(req.body);
      const wallet = await this.walletService.topUp(req.userId, dto.amount);
      res.json({ data: { wallet } });
    } catch (err) {
      next(err);
    }
  };
}
