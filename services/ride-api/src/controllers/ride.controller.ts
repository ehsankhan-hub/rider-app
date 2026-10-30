import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RideService } from '../services/ride.service';
import { AppError } from '../utils/app-error';

const quoteSchema = z.object({
  vehicleTypeId: z.string().min(8),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
});

const reviewSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
});

const createRideSchema = quoteSchema.extend({
  paymentMethod: z.enum(['CASH', 'WALLET']),
  pickupAddress: z.string().min(3),
  dropoffAddress: z.string().min(3),
  riderName: z.string().trim().min(2).max(120).optional(),
});

export class RideController {
  constructor(private readonly rideService: RideService) {}

  vehicleTypes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.rideService.listVehicleTypes();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  quote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = quoteSchema.parse(req.body);
      const data = await this.rideService.quote(dto);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUser(req);
      const dto = createRideSchema.parse(req.body);
      const data = await this.rideService.create(userId, dto);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUser(req);
      const data = await this.rideService.list(userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUser(req);
      const data = await this.rideService.get(userId, String(req.params['id']));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUser(req);
      const data = await this.rideService.cancel(userId, String(req.params['id']));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  adminCancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.userRole !== 'ADMIN') throw new AppError(403, 'Admin account required', 'FORBIDDEN');
      const data = await this.rideService.adminCancel(String(req.params['id']));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  adminReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.userRole !== 'ADMIN') throw new AppError(403, 'Admin account required', 'FORBIDDEN');
      const dto = reviewSchema.parse(req.body);
      const data = await this.rideService.review(String(req.params['id']), dto.decision);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  private requireUser(req: Request): string {
    if (!req.userId) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    return req.userId;
  }
}
