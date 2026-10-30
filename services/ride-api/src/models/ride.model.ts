import { Table, Column, Model, DataType, PrimaryKey, Default, ForeignKey, BelongsTo, HasMany, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { Driver } from './driver.model';
import { VehicleType } from './vehicle-type.model';
import { RideStatusEvent } from './ride-status-event.model';

@Table({ tableName: 'rides', timestamps: true, underscored: true })
export class Ride extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Column(DataType.CHAR(36))
  declare customerUserId: string;

  @ForeignKey(() => Driver)
  @Column(DataType.CHAR(36))
  declare driverId: string | null;

  @BelongsTo(() => Driver)
  declare driver?: Driver;

  @ForeignKey(() => VehicleType)
  @Column(DataType.CHAR(36))
  declare vehicleTypeId: string;

  @BelongsTo(() => VehicleType)
  declare vehicleType?: VehicleType;

  @Column(DataType.STRING(32))
  declare status: string;

  @Column(DataType.ENUM('CASH', 'WALLET'))
  declare paymentMethod: 'CASH' | 'WALLET';

  @Column(DataType.DECIMAL(10, 7))
  declare pickupLat: string;

  @Column(DataType.DECIMAL(10, 7))
  declare pickupLng: string;

  @Column(DataType.STRING(255))
  declare pickupAddress: string;

  @Column(DataType.DECIMAL(10, 7))
  declare dropoffLat: string;

  @Column(DataType.DECIMAL(10, 7))
  declare dropoffLng: string;

  @Column(DataType.STRING(255))
  declare dropoffAddress: string;

  @Column(DataType.DECIMAL(10, 2))
  declare distanceKm: string;

  @Column(DataType.DECIMAL(10, 2))
  declare durationMin: string;

  @Column(DataType.DECIMAL(10, 2))
  declare fareAmount: string;

  @Column(DataType.DECIMAL(10, 2))
  declare quoteFareAmount: string | null;

  @Column(DataType.DECIMAL(10, 2))
  declare quoteDistanceKm: string | null;

  @Column(DataType.DECIMAL(10, 2))
  declare quoteDurationMin: string | null;

  @Column(DataType.DECIMAL(10, 7))
  declare endLat: string | null;

  @Column(DataType.DECIMAL(10, 7))
  declare endLng: string | null;

  @Column(DataType.STRING(32))
  declare endNote: string | null;

  @Column(DataType.STRING(16))
  declare reviewStatus: 'accepted' | 'rejected' | null;

  @Column(DataType.DATE)
  declare reviewedAt: Date | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @HasMany(() => RideStatusEvent)
  declare events?: RideStatusEvent[];
}
