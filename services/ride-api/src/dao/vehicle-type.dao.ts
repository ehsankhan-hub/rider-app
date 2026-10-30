import { VehicleType } from '../models/vehicle-type.model';

export class VehicleTypeDao {
  findAll(): Promise<VehicleType[]> {
    return VehicleType.findAll({ order: [['displayName', 'ASC']] });
  }

  findAllActive(): Promise<VehicleType[]> {
    return VehicleType.findAll({ where: { isActive: true }, order: [['displayName', 'ASC']] });
  }

  save(vehicle: VehicleType): Promise<VehicleType> {
    return vehicle.save();
  }

  findById(id: string): Promise<VehicleType | null> {
    return VehicleType.findByPk(id);
  }

  findByCode(code: string): Promise<VehicleType | null> {
    return VehicleType.findOne({ where: { code } });
  }

  create(data: Partial<VehicleType>): Promise<VehicleType> {
    return VehicleType.create(data);
  }
}
