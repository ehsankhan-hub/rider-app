import { DriverDao } from '../dao/driver.dao';
import { RideDao } from '../dao/ride.dao';
import { VehicleTypeDao } from '../dao/vehicle-type.dao';
import { RideEvents } from '../sockets/ride-events';
import { CatalogService } from './catalog.service';
import { RideService } from './ride.service';
import { AppError } from '../utils/app-error';
import { Driver } from '../models/driver.model';
import { Ride } from '../models/ride.model';

export class DriverService {
  constructor(
    private readonly driverDao: DriverDao,
    private readonly rideDao: RideDao,
    private readonly vehicleTypeDao: VehicleTypeDao,
    private readonly rideEvents: RideEvents,
    private readonly catalog: CatalogService,
    private readonly rideService: RideService,
  ) {}

  async registerVehicle(userId: string, input: { vehicleTypeId: string; fullName: string }) {
    const vehicle = await this.requireActiveVehicle(input.vehicleTypeId);
    const existing = await this.driverDao.findByUserId(userId);
    if (existing) {
      throw new AppError(409, 'Vehicle type is set at registration and cannot be changed', 'VEHICLE_LOCKED');
    }
    const runtime = await this.catalog.runtime();
    await this.driverDao.create({
      userId,
      fullName: input.fullName,
      vehicleTypeId: vehicle.id,
      lat: runtime.city.lat.toFixed(7),
      lng: runtime.city.lng.toFixed(7),
      isAvailable: false,
      isOnline: false,
      onlineSince: null,
      lastSeenAt: new Date(),
    });
    return { vehicleTypeId: vehicle.id, vehicle: vehicle.displayName };
  }

  async goOnline(userId: string, input: { lat: number; lng: number; fullName: string }) {
    await this.catalog.assertServiceOpen(input.lat, input.lng);
    const existing = await this.driverDao.findByUserId(userId);
    if (!existing) {
      throw new AppError(409, 'Choose your vehicle when you create the driver account', 'VEHICLE_REQUIRED');
    }
    await this.requireActiveVehicle(existing.vehicleTypeId);
    const active = await this.rideDao.findActiveByDriver(existing.id);
    const now = new Date();
    await this.driverDao.updatePresence(existing.id, {
      lat: input.lat.toFixed(7),
      lng: input.lng.toFixed(7),
      vehicleTypeId: existing.vehicleTypeId,
      isAvailable: !active,
      fullName: input.fullName,
      isOnline: true,
      onlineSince: existing.isOnline && existing.onlineSince ? existing.onlineSince : now,
      lastSeenAt: now,
    });
    const driver = await this.driverDao.findByUserId(userId);
    return { driver, activeRide: active ? await this.rideService.present(active) : null };
  }

  async goOffline(userId: string): Promise<Driver> {
    const driver = await this.requireDriver(userId);
    const active = await this.rideDao.findActiveByDriver(driver.id);
    if (active) {
      throw new AppError(409, 'Finish the current trip before going offline', 'ACTIVE_RIDE_EXISTS');
    }
    await this.driverDao.setOffline(driver.id);
    const fresh = await this.driverDao.findById(driver.id);
    if (!fresh) throw new AppError(404, 'Driver profile not found', 'DRIVER_NOT_FOUND');
    return fresh;
  }

  async updateLocation(userId: string, lat: number, lng: number): Promise<void> {
    const driver = await this.requireDriver(userId);
    await this.driverDao.updateLocation(driver.id, lat.toFixed(7), lng.toFixed(7));
    const active = await this.rideDao.findActiveByDriver(driver.id);
    if (active) {
      this.rideEvents.emitDriverLocation(active.customerUserId, { rideId: active.id, lat, lng });
    }
  }

  async activeRide(userId: string) {
    const driver = await this.requireDriver(userId);
    const ride = await this.rideDao.findActiveByDriver(driver.id);
    return ride ? this.rideService.present(ride) : null;
  }

  async summary(userId: string) {
    const runtime = await this.catalog.runtime();
    const driver = await this.driverDao.findByUserId(userId);
    const zone = runtime.city.timezone;
    const now = new Date();
    const todayStart = zonedMidnight(now, zone, 0);
    const weekStart = zonedMidnight(now, zone, -weekdayIndex(now, zone));
    const rides = driver ? await this.rideDao.findCompletedByDriver(driver.id, weekStart) : [];
    const todayRides = rides.filter((ride) => ride.updatedAt >= todayStart);
    return {
      currency: { code: runtime.currency.code, symbol: runtime.currency.symbol },
      isOnline: Boolean(driver?.isOnline),
      onlineSince: driver?.isOnline ? driver.onlineSince : null,
      vehicleTypeId: driver?.vehicleTypeId ?? null,
      vehicle: driver?.vehicleType?.displayName ?? null,
      today: { trips: todayRides.length, fare: fareSum(todayRides) },
      week: { trips: rides.length, fare: fareSum(rides) },
      recent: rides.slice(0, 20).map((ride) => ({
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        fareAmount: ride.fareAmount,
        paymentMethod: ride.paymentMethod,
        distanceKm: ride.distanceKm,
        completedAt: ride.updatedAt,
      })),
    };
  }

  private async requireActiveVehicle(vehicleTypeId: string) {
    const vehicle = await this.vehicleTypeDao.findById(vehicleTypeId);
    if (!vehicle || !vehicle.isActive) {
      throw new AppError(404, 'Vehicle type not found', 'VEHICLE_TYPE_NOT_FOUND');
    }
    return vehicle;
  }

  private async requireDriver(userId: string): Promise<Driver> {
    const driver = await this.driverDao.findByUserId(userId);
    if (!driver) throw new AppError(404, 'Go online before updating location', 'DRIVER_NOT_FOUND');
    return driver;
  }
}

function fareSum(rides: Ride[]): string {
  return rides.reduce((total, ride) => total + Number(ride.fareAmount), 0).toFixed(2);
}

function weekdayIndex(date: Date, timeZone: string): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
    const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name);
    return index < 0 ? 0 : index;
  } catch {
    const day = date.getUTCDay();
    return day === 0 ? 6 : day - 1;
  }
}

function zonedMidnight(now: Date, timeZone: string, dayOffset: number): Date {
  try {
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [year, month, day] = stamp.split('-').map(Number);
    const guess = new Date(Date.UTC(year, month - 1, day + dayOffset));
    return new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  } catch {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + dayOffset);
    return start;
  }
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts['year']), Number(parts['month']) - 1, Number(parts['day']), Number(parts['hour']), Number(parts['minute']), Number(parts['second']));
  return asUtc - date.getTime();
}
