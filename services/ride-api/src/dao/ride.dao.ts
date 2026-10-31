import { Ride } from '../models/ride.model';
import { RideStatusEvent } from '../models/ride-status-event.model';
import { Driver } from '../models/driver.model';
import { VehicleType } from '../models/vehicle-type.model';
import { Op } from 'sequelize';

export class RideDao {
  create(data: Partial<Ride>): Promise<Ride> {
    return Ride.create(data);
  }

  findById(id: string): Promise<Ride | null> {
    return Ride.findByPk(id, {
      include: [Driver, VehicleType, RideStatusEvent],
    });
  }

  findLatestByCustomer(userId: string): Promise<Ride | null> {
    return Ride.findOne({
      where: { customerUserId: userId },
      order: [['createdAt', 'DESC']],
    });
  }

  findByCustomer(userId: string): Promise<Ride[]> {
    return Ride.findAll({
      where: { customerUserId: userId },
      include: [Driver, VehicleType],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
  }

  findActiveByCustomer(userId: string): Promise<Ride | null> {
    return Ride.findOne({
      where: {
        customerUserId: userId,
        status: { [Op.notIn]: ['completed', 'cancelled'] },
      },
      order: [['createdAt', 'DESC']],
    });
  }

  findCreatedBetween(from: Date, to: Date): Promise<Ride[]> {
    return Ride.findAll({
      where: { createdAt: { [Op.between]: [from, to] } },
      include: [Driver, VehicleType, RideStatusEvent],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
  }

  findOpen(): Promise<Ride[]> {
    return Ride.findAll({
      where: { status: { [Op.notIn]: ['completed', 'cancelled'] } },
      include: [Driver, VehicleType, RideStatusEvent],
      order: [['createdAt', 'DESC']],
    });
  }

  findSearching(vehicleTypeId: string): Promise<Ride[]> {
    return Ride.findAll({
      where: { vehicleTypeId, status: 'searching', driverId: { [Op.is]: null } },
      include: [VehicleType],
      order: [['createdAt', 'ASC']],
      limit: 20,
    });
  }

  findCompletedByDriver(driverId: string, since: Date): Promise<Ride[]> {
    return Ride.findAll({
      where: {
        driverId,
        status: 'completed',
        updatedAt: { [Op.gte]: since },
        [Op.or]: [{ reviewStatus: null }, { reviewStatus: 'accepted' }],
      },
      order: [['updatedAt', 'DESC']],
      limit: 100,
    });
  }

  findActiveByDriver(driverId: string): Promise<Ride | null> {
    return Ride.findOne({
      where: {
        driverId,
        status: { [Op.notIn]: ['completed', 'cancelled'] },
      },
      include: [Driver, VehicleType],
      order: [['createdAt', 'DESC']],
    });
  }

  async finish(
    id: string,
    end: { lat: number; lng: number } | null,
    endNote: string,
    settlement?: { fareAmount: string; distanceKm: string; durationMin: string },
  ): Promise<void> {
    await Ride.update(
      {
        status: 'completed',
        endLat: end ? end.lat.toFixed(7) : null,
        endLng: end ? end.lng.toFixed(7) : null,
        endNote,
        ...settlement,
      },
      { where: { id } },
    );
  }

  async setReview(id: string, reviewStatus: 'accepted' | 'rejected'): Promise<void> {
    await Ride.update({ reviewStatus, reviewedAt: new Date() }, { where: { id } });
  }

  async updateStatus(id: string, status: string, driverId?: string | null): Promise<void> {
    const patch: Partial<Ride> = { status };
    if (driverId !== undefined) {
      patch.driverId = driverId;
    }
    await Ride.update(patch, { where: { id } });
  }

  addEvent(rideId: string, status: string, note?: string): Promise<RideStatusEvent> {
    return RideStatusEvent.create({ rideId, status, note: note ?? null });
  }
}
