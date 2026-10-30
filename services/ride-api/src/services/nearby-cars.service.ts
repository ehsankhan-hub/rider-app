import { DriverDao } from '../dao/driver.dao';
import { haversineKm } from './geo';
import { CatalogService } from './catalog.service';

export interface NearbyCar {
  id: string;
  vehicleCode: 'economy' | 'comfort' | 'xl';
  displayName: string;
  lat: number;
  lng: number;
  heading: number;
  etaMin: number;
}

const CODES = new Set(['economy', 'comfort', 'xl']);

export class NearbyCarsService {
  constructor(
    private readonly driverDao: DriverDao,
    private readonly catalogService: CatalogService,
  ) {}

  async listAround(lat: number, lng: number): Promise<NearbyCar[]> {
    const runtime = await this.catalogService.runtime();
    const drivers = await this.driverDao.findOnlineRegistered();
    const cars: NearbyCar[] = [];
    for (const driver of drivers) {
      const code = driver.vehicleType?.code ?? '';
      if (!CODES.has(code)) continue;
      const km = haversineKm(lat, lng, Number(driver.lat), Number(driver.lng));
      if (km > runtime.assignRadiusKm) continue;
      cars.push({
        id: driver.id,
        vehicleCode: code as NearbyCar['vehicleCode'],
        displayName: driver.vehicleType?.displayName ?? code,
        lat: Number(driver.lat),
        lng: Number(driver.lng),
        heading: 0,
        etaMin: Math.max(1, Math.round(km * 2.2)),
      });
    }
    return cars.sort((a, b) => a.etaMin - b.etaMin);
  }
}
