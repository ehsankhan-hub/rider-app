import { DriverDao } from '../dao/driver.dao';
import { RideDao } from '../dao/ride.dao';
import { CatalogService } from './catalog.service';
import { Driver } from '../models/driver.model';
import { Ride } from '../models/ride.model';
import { RideStatusEvent } from '../models/ride-status-event.model';
import { haversineKm } from './geo';

const OPEN = new Set(['requested', 'searching', 'assigned', 'arriving', 'in_progress']);

export class OperationsService {
  constructor(
    private readonly driverDao: DriverDao,
    private readonly rideDao: RideDao,
    private readonly catalog: CatalogService,
  ) {}

  async board(date?: string) {
    const runtime = await this.catalog.runtime();
    const day = date ?? this.today(runtime.city.timezone);
    const { from, to } = this.bounds(day, runtime.city.timezone);
    const [fleet, windowRides, openRides] = await Promise.all([
      this.driverDao.findRegistered(),
      this.rideDao.findCreatedBetween(from, to),
      this.rideDao.findOpen(),
    ]);
    const openDriverIds = new Set(openRides.map((ride) => ride.driverId).filter((id): id is string => Boolean(id)));
    const drivers = fleet
      .map((driver) => this.toDriver(driver, openDriverIds.has(driver.id)))
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.fullName.localeCompare(b.fullName));
    const online = drivers.filter((driver) => driver.isOnline);
    const byVehicle = this.vehicleRollup(drivers, windowRides);
    const completed = windowRides.filter((ride) => ride.status === 'completed');
    const counted = completed.filter((ride) => ride.reviewStatus !== 'rejected');
    return {
      timezone: runtime.city.timezone,
      city: runtime.city.name,
      currency: runtime.currency.code,
      date: day,
      live: {
        online: online.length,
        free: online.filter((driver) => driver.isAvailable && !driver.onTrip).length,
        onTrip: online.filter((driver) => driver.onTrip).length,
      },
      window: {
        trips: windowRides.length,
        completed: completed.length,
        cancelled: windowRides.filter((ride) => ride.status === 'cancelled').length,
        open: windowRides.filter((ride) => OPEN.has(ride.status)).length,
        fareAmount: Number(counted.reduce((sum, ride) => sum + Number(ride.fareAmount), 0).toFixed(2)),
      },
      byVehicle,
      drivers,
      rides: [...openRides, ...windowRides.filter((ride) => !OPEN.has(ride.status))].slice(0, 40).map((ride) => this.toRide(ride)),
    };
  }

  private toDriver(driver: Driver, onTrip: boolean) {
    return {
      id: driver.id,
      fullName: driver.fullName,
      vehicleCode: driver.vehicleType?.code ?? '',
      vehicleName: driver.vehicleType?.displayName ?? '',
      isOnline: driver.isOnline,
      isAvailable: driver.isAvailable,
      onTrip,
      onlineSince: this.iso(driver.onlineSince),
      lastSeenAt: this.iso(driver.lastSeenAt),
    };
  }

  private toRide(ride: Ride) {
    const events = [...(ride.events ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const stopFromPickupKm = this.between(ride.endLat, ride.endLng, ride.pickupLat, ride.pickupLng);
    const stopFromDropoffKm = this.between(ride.endLat, ride.endLng, ride.dropoffLat, ride.dropoffLng);
    const elapsedSec = this.elapsedSec(events);
    return {
      id: ride.id,
      status: ride.status,
      paymentMethod: ride.paymentMethod,
      vehicleCode: ride.vehicleType?.code ?? '',
      vehicleName: ride.vehicleType?.displayName ?? '',
      driverName: ride.driver?.fullName ?? '',
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      fareAmount: ride.fareAmount,
      distanceKm: ride.distanceKm,
      durationMin: ride.durationMin,
      quoteFareAmount: ride.quoteFareAmount,
      quoteDistanceKm: ride.quoteDistanceKm,
      quoteDurationMin: ride.quoteDurationMin,
      createdAt: this.iso(ride.createdAt),
      endNote: ride.endNote,
      reviewStatus: ride.reviewStatus,
      stopFromPickupKm,
      stopFromDropoffKm,
      elapsedSec,
      reviewHint: this.reviewHint(ride, stopFromPickupKm, stopFromDropoffKm, elapsedSec),
      events: events.map((event) => ({
        status: event.status,
        note: event.note,
        createdAt: this.iso(event.createdAt),
      })),
    };
  }

  private between(lat: string | null, lng: string | null, otherLat: string, otherLng: string): number | null {
    if (lat == null || lng == null) return null;
    const km = haversineKm(Number(lat), Number(lng), Number(otherLat), Number(otherLng));
    return Number.isFinite(km) ? Number(km.toFixed(2)) : null;
  }

  private elapsedSec(events: RideStatusEvent[]): number | null {
    const started = events.filter((event) => event.status === 'in_progress').at(-1);
    const ended = events.find((event) => event.status === 'completed');
    if (!started || !ended) return null;
    return Math.max(0, Math.round((ended.createdAt.getTime() - started.createdAt.getTime()) / 1000));
  }

  private reviewHint(
    ride: Ride,
    stopFromPickupKm: number | null,
    stopFromDropoffKm: number | null,
    elapsedSec: number | null,
  ): string | null {
    if (ride.endNote !== 'needs_review' && ride.endNote !== 'ended_early') return null;
    const quote = ride.quoteFareAmount ? `Quoted fare ${ride.quoteFareAmount} for ${ride.quoteDistanceKm} km.` : 'The original quote was not stored.';
    const charged = `Charged fare ${ride.fareAmount}.`;
    const clock = elapsedSec == null ? 'The trip clock is missing.' : `The trip ran for ${this.clock(elapsedSec)}.`;
    if (ride.endNote === 'needs_review') {
      const stop = stopFromPickupKm != null && stopFromPickupKm < 0.05
        ? 'The car stopped at the pickup.'
        : `The car stopped ${stopFromPickupKm ?? '—'} km from the pickup.`;
      const away = stopFromDropoffKm == null ? '' : ` The booked drop-off is ${stopFromDropoffKm} km from that stop.`;
      return `${stop}${away} ${clock} ${quote} ${charged}`;
    }
    const short = stopFromDropoffKm == null ? 'The car did not reach the drop-off.' : `The car stopped ${stopFromDropoffKm} km short of the drop-off.`;
    return `${short} ${clock} ${quote} ${charged} Distance used for the charge: ${ride.distanceKm} km.`;
  }

  private clock(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.round(seconds / 60);
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  private vehicleRollup(
    drivers: Array<{ vehicleCode: string; vehicleName: string; isOnline: boolean; isAvailable: boolean; onTrip: boolean }>,
    rides: Ride[],
  ) {
    const codes = new Set<string>([...drivers.map((driver) => driver.vehicleCode), ...rides.map((ride) => ride.vehicleType?.code ?? '')]);
    codes.delete('');
    return [...codes].sort().map((code) => {
      const named = drivers.find((driver) => driver.vehicleCode === code)?.vehicleName
        ?? rides.find((ride) => ride.vehicleType?.code === code)?.vehicleType?.displayName
        ?? code;
      const group = drivers.filter((driver) => driver.vehicleCode === code);
      const tripGroup = rides.filter((ride) => ride.vehicleType?.code === code && ride.status === 'completed' && ride.reviewStatus !== 'rejected');
      return {
        code,
        name: named,
        online: group.filter((driver) => driver.isOnline).length,
        free: group.filter((driver) => driver.isOnline && driver.isAvailable && !driver.onTrip).length,
        onTrip: group.filter((driver) => driver.isOnline && driver.onTrip).length,
        completed: tripGroup.length,
        fareAmount: Number(tripGroup.reduce((sum, ride) => sum + Number(ride.fareAmount), 0).toFixed(2)),
      };
    });
  }

  private today(timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  private bounds(date: string, timeZone: string): { from: Date; to: Date } {
    return { from: this.zoned(date, '00:00:00', timeZone), to: this.zoned(date, '23:59:59', timeZone) };
  }

  private zoned(date: string, time: string, timeZone: string): Date {
    const utc = new Date(`${date}T${time}Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(utc);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'));
    return new Date(utc.getTime() - (asUtc - utc.getTime()));
  }

  private iso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
