import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DriverService } from '../services/driver.service';
import { RideService } from '../services/ride.service';
import { RouteService } from '../services/route.service';
import { AppError } from '../utils/app-error';

const onlineSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  fullName: z.string().min(2).max(120),
});

const vehicleSchema = z.object({
  vehicleTypeId: z.string().min(8),
  fullName: z.string().min(2).max(120),
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const routeQuery = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
});

const statusSchema = z.object({
  status: z.enum(['arriving', 'in_progress', 'completed']),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  confirmStop: z.boolean().optional(),
});

export class DriverController {
  constructor(
    private readonly driverService: DriverService,
    private readonly rideService: RideService,
    private readonly routeService: RouteService,
  ) {}

  registerVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const dto = vehicleSchema.parse(req.body);
      const data = await this.driverService.registerVehicle(userId, dto);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  };

  online = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const dto = onlineSchema.parse(req.body);
      const data = await this.driverService.goOnline(userId, dto);
      if (data.driver && data.driver.isAvailable && !data.activeRide) {
        const claimed = await this.rideService.claimNext(data.driver);
        if (claimed) data.activeRide = claimed;
      }
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  offline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const data = await this.driverService.goOffline(userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  route = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireDriver(req);
      const query = routeQuery.parse(req.query);
      const route = await this.routeService.driving(query.fromLat, query.fromLng, query.toLat, query.toLng);
      res.json({ data: { coordinates: route.coordinates } });
    } catch (err) {
      next(err);
    }
  };

  location = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const dto = locationSchema.parse(req.body);
      await this.driverService.updateLocation(userId, dto.lat, dto.lng);
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  };

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const data = await this.driverService.summary(userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  pass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const data = await this.rideService.pass(userId, String(req.params['id']));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  active = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const data = await this.driverService.activeRide(userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireDriver(req);
      const dto = statusSchema.parse(req.body);
      const data = await this.rideService.advance(userId, String(req.params['id']), dto.status, {
        lat: dto.lat,
        lng: dto.lng,
        confirmStop: dto.confirmStop,
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  private requireDriver(req: Request): string {
    if (!req.userId || req.userRole !== 'DRIVER') {
      throw new AppError(403, 'Driver account required', 'FORBIDDEN');
    }
    return req.userId;
  }
}
