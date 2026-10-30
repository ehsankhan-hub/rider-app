import { logger } from '../config/logger';
import { haversineKm } from './geo';

export interface DrivingRoute {
  distanceKm: number;
  freeFlowMin: number;
  coordinates: Array<[number, number]>;
}

interface OsrmRoute {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: Array<[number, number]> };
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

const TTL_MS = 2 * 60 * 1000;

export class RouteService {
  private readonly cache = new Map<string, { at: number; route: DrivingRoute }>();

  async driving(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): Promise<DrivingRoute> {
    const key = [pickupLat, pickupLng, dropoffLat, dropoffLng].map((n) => n.toFixed(4)).join(',');
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return cached.route;
    }
    const route = (await this.fromOsrm(pickupLat, pickupLng, dropoffLat, dropoffLng)) ?? this.fallback(pickupLat, pickupLng, dropoffLat, dropoffLng);
    this.cache.set(key, { at: Date.now(), route });
    return route;
  }

  private async fromOsrm(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ): Promise<DrivingRoute | null> {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=simplified&geometries=geojson`;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'RiderPlatform/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        logger.warn({ status: response.status }, 'Driving route failed');
        return null;
      }
      const body = (await response.json()) as OsrmResponse;
      const route = body.routes?.[0];
      if (body.code !== 'Ok' || !route?.distance || !route.duration) return null;
      const coordinates = (route.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
      return {
        distanceKm: route.distance / 1000,
        freeFlowMin: route.duration / 60,
        coordinates,
      };
    } catch (err) {
      logger.warn({ err }, 'Driving route unavailable');
      return null;
    }
  }

  private fallback(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): DrivingRoute {
    const straightKm = haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const distanceKm = straightKm * 1.35;
    return {
      distanceKm,
      freeFlowMin: (distanceKm / 32) * 60,
      coordinates: [
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ],
    };
  }
}
