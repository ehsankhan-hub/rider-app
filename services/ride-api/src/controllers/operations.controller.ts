import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OperationsService } from '../services/operations.service';
import { AppError } from '../utils/app-error';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  board = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.userRole !== 'ADMIN') {
        throw new AppError(403, 'Admin account required', 'FORBIDDEN');
      }
      const query = querySchema.parse(req.query);
      res.json({ data: await this.operations.board(query.date) });
    } catch (err) {
      next(err);
    }
  };
}
