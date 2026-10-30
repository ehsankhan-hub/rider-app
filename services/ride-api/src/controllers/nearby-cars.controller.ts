import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NearbyCarsService } from '../services/nearby-cars.service';

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export class NearbyCarsController {
  constructor(private readonly nearbyCarsService: NearbyCarsService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = nearbySchema.parse(req.query);
      const data = await this.nearbyCarsService.listAround(dto.lat, dto.lng);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };
}
