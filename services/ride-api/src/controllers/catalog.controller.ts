import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CatalogService } from '../services/catalog.service';
import { AppError } from '../utils/app-error';

const countrySchema = z.object({
  name: z.string().trim().min(2).max(80),
  isoCode: z.string().trim().length(2),
  isActive: z.boolean().optional().default(true),
});

const countryPatchSchema = countrySchema.partial().refine((value) => Object.keys(value).length > 0);

const stateSchema = z.object({
  countryId: z.string().min(8),
  name: z.string().trim().min(2).max(80),
  isActive: z.boolean().optional().default(true),
});

const statePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const citySchema = z.object({
  stateId: z.string().min(8),
  name: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(64),
  isActive: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});

const cityPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const currencySchema = z.object({
  code: z.string().trim().length(3),
  symbol: z.string().trim().min(1).max(8),
  name: z.string().trim().min(2).max(80),
  isActive: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});

const currencyPatchSchema = z
  .object({
    symbol: z.string().trim().min(1).max(8).optional(),
    name: z.string().trim().min(2).max(80).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const settingsSchema = z.object({
  assignRadiusKm: z.number().min(1).max(100),
  openingWalletAmount: z.number().min(0).max(100000),
  weekendDays: z.string().trim().min(3).max(40),
});

const vehiclePatchSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    baseFare: z.number().min(0).max(10000).optional(),
    perKm: z.number().min(0).max(10000).optional(),
    perMinute: z.number().min(0).max(10000).optional(),
    capacity: z.number().int().min(1).max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  config = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await this.catalog.runtime() });
    } catch (err) {
      next(err);
    }
  };

  adminCatalog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      res.json({ data: await this.catalog.adminCatalog() });
    } catch (err) {
      next(err);
    }
  };

  createCountry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.createCountry(countrySchema.parse(req.body));
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateCountry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.updateCountry(String(req.params['id']), countryPatchSchema.parse(req.body));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  createState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.createState(stateSchema.parse(req.body));
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.updateState(String(req.params['id']), statePatchSchema.parse(req.body));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  createCity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.createCity(citySchema.parse(req.body));
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateCity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.updateCity(String(req.params['id']), cityPatchSchema.parse(req.body));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  createCurrency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.createCurrency(currencySchema.parse(req.body));
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateCurrency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.updateCurrency(String(req.params['id']), currencyPatchSchema.parse(req.body));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      await this.catalog.updateSettings(settingsSchema.parse(req.body));
      res.json({ data: await this.catalog.runtime() });
    } catch (err) {
      next(err);
    }
  };

  updateVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireAdmin(req);
      const data = await this.catalog.updateVehicle(String(req.params['id']), vehiclePatchSchema.parse(req.body));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  private requireAdmin(req: Request): void {
    if (req.userRole !== 'ADMIN') {
      throw new AppError(403, 'Admin account required', 'FORBIDDEN');
    }
  }
}
