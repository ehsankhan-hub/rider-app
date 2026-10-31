import { RideDao } from '../dao/ride.dao';
import { VehicleTypeDao } from '../dao/vehicle-type.dao';
import { DriverDao } from '../dao/driver.dao';
import { CustomerProfileDao } from '../dao/customer-profile.dao';
import { PricingService } from './pricing.service';
import { DispatchService } from './dispatch.service';
import { CatalogService } from './catalog.service';
import { CountryStamp } from './country-stamp';
import { haversineKm } from './geo';
import { confirmStopMessage, decideEnd, settleFare } from './ride-end';
import { Driver } from '../models/driver.model';
import { Ride } from '../models/ride.model';
import { WalletService } from './wallet.service';
import { AppError } from '../utils/app-error';
import { RideEvents } from '../sockets/ride-events';

export interface CreateRideInput {
  vehicleTypeId: string;
  paymentMethod: 'CASH' | 'WALLET';
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  riderName?: string;
}

export class RideService {
  constructor(
    private readonly rideDao: RideDao,
    private readonly vehicleTypeDao: VehicleTypeDao,
    private readonly driverDao: DriverDao,
    private readonly pricingService: PricingService,
    private readonly dispatchService: DispatchService,
    private readonly walletService: WalletService,
    private readonly rideEvents: RideEvents,
    private readonly catalogService: CatalogService,
    private readonly customers: CustomerProfileDao,
    private readonly countries: CountryStamp,
  ) {}

  async rememberCountry(userId: string, fullName: string | undefined, lat: number, lng: number): Promise<void> {
    const home = await this.countries.at(lat, lng);
    await this.customers.remember(userId, fullName, home);
  }

  listVehicleTypes() {
    return this.vehicleTypeDao.findAllActive();
  }

  quote(input: Parameters<PricingService['quote']>[0]) {
    return this.pricingService.quote(input);
  }

  async create(userId: string, input: CreateRideInput) {
    const active = await this.rideDao.findActiveByCustomer(userId);
    if (active) {
      throw new AppError(409, 'You already have an active ride', 'ACTIVE_RIDE_EXISTS');
    }

    const quote = await this.pricingService.quote(input);
    if (input.riderName) await this.customers.saveName(userId, input.riderName);
    const home = await this.countries.at(input.pickupLat, input.pickupLng);
    await this.customers.remember(userId, input.riderName, home);

    const ride = await this.rideDao.create({
      customerUserId: userId,
      vehicleTypeId: input.vehicleTypeId,
      status: 'requested',
      paymentMethod: input.paymentMethod,
      pickupLat: String(input.pickupLat),
      pickupLng: String(input.pickupLng),
      pickupAddress: input.pickupAddress,
      dropoffLat: String(input.dropoffLat),
      dropoffLng: String(input.dropoffLng),
      dropoffAddress: input.dropoffAddress,
      distanceKm: String(quote.distanceKm),
      durationMin: String(quote.durationMin),
      fareAmount: String(quote.fareAmount),
      quoteDistanceKm: String(quote.distanceKm),
      quoteDurationMin: String(quote.durationMin),
      quoteFareAmount: String(quote.fareAmount),
    });

    if (input.paymentMethod === 'WALLET') {
      try {
        await this.walletService.debitForRide(userId, quote.fareAmount, ride.id);
      } catch (err) {
        await this.rideDao.updateStatus(ride.id, 'cancelled');
        await this.rideDao.addEvent(ride.id, 'cancelled', 'Wallet debit failed');
        throw err;
      }
    }

    await this.rideDao.addEvent(ride.id, 'requested', 'Ride requested');
    await this.rideDao.updateStatus(ride.id, 'searching');
    await this.rideDao.addEvent(ride.id, 'searching', 'Looking for a nearby driver');

    const runtime = await this.catalogService.runtime();
    const driver = await this.dispatchService.assignNearest(
      input.vehicleTypeId,
      input.pickupLat,
      input.pickupLng,
      runtime.assignRadiusKm,
    );

    if (driver) {
      await this.driverDao.setAvailable(driver.id, false);
      await this.rideDao.updateStatus(ride.id, 'assigned', driver.id);
      await this.rideDao.addEvent(ride.id, 'assigned', `Assigned to ${driver.fullName}`);
    }

    const fresh = await this.rideDao.findById(ride.id);
    await this.publish(fresh, driver?.userId ?? null);
    return fresh;
  }

  async claimNext(driver: Driver) {
    if (!driver.userId || !driver.isAvailable) return null;
    const waiting = await this.rideDao.findSearching(driver.vehicleTypeId);
    let chosen: (typeof waiting)[number] | null = null;
    let bestKm = Number.POSITIVE_INFINITY;
    for (const ride of waiting) {
      const km = haversineKm(Number(driver.lat), Number(driver.lng), Number(ride.pickupLat), Number(ride.pickupLng));
      if (km < bestKm) {
        bestKm = km;
        chosen = ride;
      }
    }
    const runtime = await this.catalogService.runtime();
    if (!chosen || bestKm > runtime.assignRadiusKm) return null;
    await this.driverDao.setAvailable(driver.id, false);
    await this.rideDao.updateStatus(chosen.id, 'assigned', driver.id);
    await this.rideDao.addEvent(chosen.id, 'assigned', `Assigned to ${driver.fullName}`);
    const fresh = await this.rideDao.findById(chosen.id);
    return this.publish(fresh, driver.userId);
  }

  async get(userId: string, rideId: string) {
    const ride = await this.rideDao.findById(rideId);
    if (!ride || ride.customerUserId !== userId) {
      throw new AppError(404, 'Ride not found', 'RIDE_NOT_FOUND');
    }
    return ride;
  }

  list(userId: string) {
    return this.rideDao.findByCustomer(userId);
  }

  async cancel(userId: string, rideId: string) {
    const ride = await this.get(userId, rideId);
    if (['completed', 'cancelled', 'in_progress'].includes(ride.status)) {
      throw new AppError(409, 'Ride cannot be cancelled', 'CANNOT_CANCEL');
    }
    if (ride.driverId) {
      await this.driverDao.setAvailable(ride.driverId, true);
    }
    await this.rideDao.updateStatus(ride.id, 'cancelled');
    await this.rideDao.addEvent(ride.id, 'cancelled', 'Cancelled by customer');
    if (ride.paymentMethod === 'WALLET') {
      await this.walletService.refundRide(userId, Number(ride.fareAmount), ride.id);
    }
    const fresh = await this.rideDao.findById(ride.id);
    await this.publish(fresh, fresh?.driver?.userId ?? null);
    return fresh;
  }

  async adminCancel(rideId: string) {
    const ride = await this.rideDao.findById(rideId);
    if (!ride) throw new AppError(404, 'Ride not found', 'RIDE_NOT_FOUND');
    if (['completed', 'cancelled'].includes(ride.status)) {
      throw new AppError(409, 'Ride cannot be cancelled', 'CANNOT_CANCEL');
    }
    if (ride.driverId) await this.driverDao.setAvailable(ride.driverId, true);
    await this.rideDao.updateStatus(ride.id, 'cancelled');
    await this.rideDao.addEvent(ride.id, 'cancelled', 'Cancelled by admin');
    if (ride.paymentMethod === 'WALLET') {
      await this.walletService.refundRide(ride.customerUserId, Number(ride.fareAmount), ride.id);
    }
    const fresh = await this.rideDao.findById(ride.id);
    await this.publish(fresh, fresh?.driver?.userId ?? null);
    return fresh;
  }

  async review(rideId: string, decision: 'accepted' | 'rejected') {
    const ride = await this.rideDao.findById(rideId);
    if (!ride) throw new AppError(404, 'Ride not found', 'RIDE_NOT_FOUND');
    if (ride.endNote !== 'needs_review' && ride.endNote !== 'ended_early') {
      throw new AppError(409, 'This trip reached the drop-off and does not need a review', 'REVIEW_NOT_REQUIRED');
    }
    if (ride.reviewStatus) {
      throw new AppError(409, 'This trip has already been reviewed', 'ALREADY_REVIEWED');
    }
    if (decision === 'rejected' && ride.paymentMethod === 'WALLET' && Number(ride.fareAmount) > 0) {
      await this.walletService.refundRide(ride.customerUserId, Number(ride.fareAmount), ride.id);
    }
    await this.rideDao.setReview(ride.id, decision);
    const note = decision === 'accepted'
      ? 'Admin accepted the charged fare.'
      : 'Admin marked this trip fake. Fare left out of driver earnings.';
    await this.rideDao.addEvent(ride.id, 'completed', note);
    return this.rideDao.findById(ride.id);
  }

  async pass(driverUserId: string, rideId: string) {
    const driver = await this.driverDao.findByUserId(driverUserId);
    if (!driver) throw new AppError(404, 'Driver profile not found', 'DRIVER_NOT_FOUND');
    const ride = await this.rideDao.findById(rideId);
    if (!ride || ride.driverId !== driver.id) throw new AppError(404, 'Ride not found', 'RIDE_NOT_FOUND');
    if (!['assigned', 'arriving'].includes(ride.status)) {
      throw new AppError(409, 'You can pass a trip only before it starts', 'CANNOT_PASS');
    }
    await this.driverDao.setAvailable(driver.id, true);
    await this.rideDao.updateStatus(ride.id, 'searching', null);
    await this.rideDao.addEvent(ride.id, 'searching', `${driver.fullName} passed this trip`);
    const runtime = await this.catalogService.runtime();
    const next = await this.dispatchService.assignNearest(
      ride.vehicleTypeId,
      Number(ride.pickupLat),
      Number(ride.pickupLng),
      runtime.assignRadiusKm,
      driver.id,
    );
    if (next) {
      await this.driverDao.setAvailable(next.id, false);
      await this.rideDao.updateStatus(ride.id, 'assigned', next.id);
      await this.rideDao.addEvent(ride.id, 'assigned', `Assigned to ${next.fullName}`);
    }
    const fresh = await this.rideDao.findById(ride.id);
    return this.publish(fresh, driver.userId, next?.userId ?? null);
  }

  async advance(
    driverUserId: string,
    rideId: string,
    nextStatus: 'arriving' | 'in_progress' | 'completed',
    options?: { lat?: number; lng?: number; confirmStop?: boolean },
  ) {
    const driver = await this.driverDao.findByUserId(driverUserId);
    if (!driver) {
      throw new AppError(404, 'Driver profile not found', 'DRIVER_NOT_FOUND');
    }
    const ride = await this.rideDao.findById(rideId);
    if (!ride || ride.driverId !== driver.id) {
      throw new AppError(404, 'Ride not found', 'RIDE_NOT_FOUND');
    }
    const allowed: Record<string, string> = {
      assigned: 'arriving',
      arriving: 'in_progress',
      in_progress: 'completed',
    };
    if (allowed[ride.status] !== nextStatus) {
      throw new AppError(409, 'Ride cannot move to that status', 'INVALID_STATUS');
    }
    if (nextStatus === 'completed') {
      const here = this.endPoint(options, driver);
      const note = decideEnd({
        here,
        pickup: { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) },
        dropoff: { lat: Number(ride.dropoffLat), lng: Number(ride.dropoffLng) },
        startedAt: this.tripStartedAt(ride.events),
        now: new Date(),
      });
      if (note !== 'at_dropoff' && !options?.confirmStop) {
        throw new AppError(409, confirmStopMessage(note), 'CONFIRM_STOP');
      }
      const settlement = note === 'at_dropoff' ? undefined : await this.settleEarlyStop(ride, here);
      await this.rideDao.finish(ride.id, here, note, settlement);
      await this.rideDao.addEvent(ride.id, 'completed', this.endEventNote(note));
      await this.driverDao.setAvailable(driver.id, true);
    } else {
      await this.rideDao.updateStatus(ride.id, nextStatus);
      await this.rideDao.addEvent(ride.id, nextStatus, `Driver set ${nextStatus}`);
    }
    const fresh = await this.rideDao.findById(ride.id);
    return this.publish(fresh, driver.userId);
  }

  private endPoint(
    options: { lat?: number; lng?: number } | undefined,
    driver: Driver,
  ): { lat: number; lng: number } | null {
    const sent = this.point(options?.lat, options?.lng);
    if (sent) return sent;
    if (driver.lat == null || driver.lng == null) return null;
    return this.point(Number(driver.lat), Number(driver.lng));
  }

  private point(lat: number | undefined, lng: number | undefined): { lat: number; lng: number } | null {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  private tripStartedAt(events: Ride['events']): Date | null {
    const started = (events ?? []).filter((event) => event.status === 'in_progress' && event.createdAt);
    if (started.length === 0) return null;
    return started.reduce((latest, event) => (event.createdAt > latest.createdAt ? event : latest)).createdAt;
  }

  private async settleEarlyStop(
    ride: Ride,
    here: { lat: number; lng: number } | null,
  ): Promise<{ fareAmount: string; distanceKm: string; durationMin: string } | undefined> {
    const vehicle = ride.vehicleType ?? (await this.vehicleTypeDao.findById(ride.vehicleTypeId));
    if (!vehicle) return undefined;
    const started = this.tripStartedAt(ride.events);
    const elapsedMin = started ? (Date.now() - started.getTime()) / 60_000 : 0;
    const traveledKm = here ? haversineKm(Number(ride.pickupLat), Number(ride.pickupLng), here.lat, here.lng) : 0;
    const settled = settleFare({
      upfront: Number(ride.fareAmount),
      base: Number(vehicle.baseFare),
      perKm: Number(vehicle.perKm),
      perMinute: Number(vehicle.perMinute),
      traveledKm,
      elapsedMin,
    });
    const refund = Number((Number(ride.fareAmount) - settled.fare).toFixed(2));
    if (ride.paymentMethod === 'WALLET' && refund > 0) {
      await this.walletService.refundRide(ride.customerUserId, refund, ride.id);
    }
    return {
      fareAmount: settled.fare.toFixed(2),
      distanceKm: settled.distanceKm.toFixed(2),
      durationMin: settled.durationMin.toFixed(2),
    };
  }

  private endEventNote(note: string): string {
    if (note === 'needs_review') return 'Ended at the pickup. Charged the minimum fare.';
    if (note === 'ended_early') return 'Rider got out before the drop-off. Fare recalculated for the distance driven.';
    return 'Ended at the drop-off';
  }

  async present(ride: Ride) {
    const profile = await this.customers.findByUserId(ride.customerUserId);
    return { ...ride.toJSON(), riderName: profile?.fullName ?? 'Rider' };
  }

  private async publish(ride: Ride | null, ...driverUserIds: Array<string | null | undefined>) {
    if (!ride) return null;
    const payload = await this.present(ride);
    this.rideEvents.emitRideUpdate(ride.customerUserId, payload);
    for (const id of new Set(driverUserIds)) {
      if (id) this.rideEvents.emitRideUpdate(id, payload);
    }
    return payload;
  }
}
