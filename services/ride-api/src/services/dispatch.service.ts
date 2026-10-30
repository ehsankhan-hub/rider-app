import { DriverDao } from '../dao/driver.dao';
import { haversineKm } from './geo';
import { Driver } from '../models/driver.model';

export const ASSIGN_RADIUS_KM = 25;

export class DispatchService {
  constructor(private readonly driverDao: DriverDao) {}

  async assignNearest(
    vehicleTypeId: string,
    pickupLat: number,
    pickupLng: number,
    radiusKm = ASSIGN_RADIUS_KM,
    excludeDriverId?: string,
  ): Promise<Driver | null> {
    const drivers = await this.driverDao.findAvailableByVehicleType(vehicleTypeId);
    let best: Driver | null = null;
    let bestKm = Number.POSITIVE_INFINITY;
    for (const driver of drivers) {
      if (!driver.userId || driver.id === excludeDriverId) continue;
      const km = haversineKm(pickupLat, pickupLng, Number(driver.lat), Number(driver.lng));
      if (km < bestKm) {
        bestKm = km;
        best = driver;
      }
    }
    if (best && bestKm <= radiusKm) return best;
    return null;
  }
}
