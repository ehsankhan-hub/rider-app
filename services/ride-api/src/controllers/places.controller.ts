import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PlacesService } from '../services/places.service';

const searchSchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  lang: z.enum(['en', 'ar']).optional().default('en'),
});

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  lang: z.enum(['en', 'ar']).optional().default('en'),
});

export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = searchSchema.parse(req.query);
      const data = dto.q.length < 2 ? [] : await this.placesService.search(dto);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  reverse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = reverseSchema.parse(req.query);
      const data = await this.placesService.reverse(dto.lat, dto.lng, dto.lang);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };
}
