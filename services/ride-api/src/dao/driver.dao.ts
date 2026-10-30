import { Op } from 'sequelize';
import { Driver } from '../models/driver.model';
import { VehicleType } from '../models/vehicle-type.model';

export class DriverDao {
  findAvailableByVehicleType(vehicleTypeId: string): Promise<Driver[]> {
    return Driver.findAll({
      where: { vehicleTypeId, isAvailable: true, isOnline: true, userId: { [Op.ne]: null } },
    });
  }

  findOnlineRegistered(): Promise<Driver[]> {
    return Driver.findAll({
      where: { isAvailable: true, isOnline: true, userId: { [Op.ne]: null } },
      include: [VehicleType],
    });
  }

  findRegistered(): Promise<Driver[]> {
    return Driver.findAll({
      where: { userId: { [Op.ne]: null } },
      include: [VehicleType],
      order: [['fullName', 'ASC']],
    });
  }

  findById(id: string): Promise<Driver | null> {
    return Driver.findByPk(id);
  }

  findByUserId(userId: string): Promise<Driver | null> {
    return Driver.findOne({ where: { userId }, include: [VehicleType] });
  }

  async updatePresence(
    id: string,
    data: {
      lat: string;
      lng: string;
      vehicleTypeId: string;
      isAvailable: boolean;
      fullName: string;
      isOnline: boolean;
      onlineSince: Date | null;
      lastSeenAt: Date;
    },
  ): Promise<void> {
    await Driver.update(data, { where: { id } });
  }

  async updateLocation(id: string, lat: string, lng: string): Promise<void> {
    await Driver.update({ lat, lng, lastSeenAt: new Date() }, { where: { id } });
  }

  async setAvailable(id: string, isAvailable: boolean): Promise<void> {
    await Driver.update({ isAvailable }, { where: { id } });
  }

  async setOffline(id: string): Promise<void> {
    await Driver.update({ isOnline: false, isAvailable: false, lastSeenAt: new Date() }, { where: { id } });
  }

  count(): Promise<number> {
    return Driver.count();
  }

  create(data: Partial<Driver>): Promise<Driver> {
    return Driver.create(data);
  }
}
