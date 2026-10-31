import { VehicleTypeDao } from '../dao/vehicle-type.dao';
import { AppError } from '../utils/app-error';
import { CatalogService } from './catalog.service';
import { RouteService } from './route.service';

export type TrafficBand = 'light' | 'normal' | 'busy' | 'peak';

export interface TrafficProfile {
  band: TrafficBand;
  durationFactor: number;
  fareFactor: number;
}

/** City-local clock. Traffic changes how long the trip is expected to take. The fare itself stays base + kilometres + minutes, which is how Uber builds an upfront price. A demand surge would multiply that total; this city does not invent one from the clock. */
export function trafficProfile(
  now = new Date(),
  timeZone = 'Asia/Riyadh',
  weekendDays: string[] = ['Fri', 'Sat'],
): TrafficProfile {
  const hour = Number(part(now, timeZone, 'hour'));
  const weekday = part(now, timeZone, 'weekday');
  const weekend = weekendDays.includes(weekday);

  if (weekend) {
    if (hour >= 17 && hour < 22) return { band: 'busy', durationFactor: 1.25, fareFactor: 1.15 };
    if (hour < 6) return { band: 'light', durationFactor: 0.9, fareFactor: 1 };
    return { band: 'normal', durationFactor: 1.05, fareFactor: 1 };
  }

  if (hour >= 7 && hour < 10) return { band: 'peak', durationFactor: 1.6, fareFactor: 1.4 };
  if (hour >= 16 && hour < 20) return { band: 'peak', durationFactor: 1.75, fareFactor: 1.45 };
  if ((hour >= 6 && hour < 7) || (hour >= 15 && hour < 16) || (hour >= 20 && hour < 22)) {
    return { band: 'busy', durationFactor: 1.3, fareFactor: 1.15 };
  }
  if (hour >= 10 && hour < 15) return { band: 'normal', durationFactor: 1.15, fareFactor: 1 };
  return { band: 'light', durationFactor: 0.9, fareFactor: 1 };
}

function part(now: Date, timeZone: string, type: 'hour' | 'weekday'): string {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  })
    .formatToParts(now)
    .find((item) => item.type === type)?.value;
  return value ?? (type === 'hour' ? '12' : 'Sun');
}

export class PricingService {
  constructor(
    private readonly vehicleTypeDao: VehicleTypeDao,
    private readonly routeService: RouteService,
    private readonly catalogService: CatalogService,
  ) {}

  async quote(input: {
    vehicleTypeId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }) {
    const vt = await this.vehicleTypeDao.findById(input.vehicleTypeId);
    if (!vt || !vt.isActive) {
      throw new AppError(404, 'Vehicle type not found', 'VEHICLE_TYPE_NOT_FOUND');
    }

    await this.catalogService.assertServiceOpen(input.pickupLat, input.pickupLng);
    const route = await this.routeService.driving(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng);
    const runtime = await this.catalogService.runtime();
    const zone = this.catalogService.timezoneAt(input.pickupLat, input.pickupLng, runtime.city.timezone);
    const traffic = trafficProfile(new Date(), zone, runtime.weekendDays);
    const durationMin = Math.max(4, route.freeFlowMin * traffic.durationFactor);
    const base = Number(vt.baseFare);
    const distanceCharge = route.distanceKm * Number(vt.perKm);
    const timeCharge = durationMin * Number(vt.perMinute);
    const fare = base + distanceCharge + timeCharge;

    return {
      vehicleTypeId: vt.id,
      vehicleCode: vt.code,
      displayName: vt.displayName,
      distanceKm: Number(route.distanceKm.toFixed(2)),
      durationMin: Math.round(durationMin),
      freeFlowMin: Number(route.freeFlowMin.toFixed(1)),
      trafficBand: traffic.band,
      fareFactor: 1,
      fareAmount: Number(Math.max(fare, base).toFixed(2)),
      currency: runtime.currency.code,
      route: route.coordinates,
    };
  }
}
