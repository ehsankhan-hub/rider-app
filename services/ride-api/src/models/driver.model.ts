import { Table, Column, Model, DataType, PrimaryKey, Default, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { VehicleType } from './vehicle-type.model';

@Table({ tableName: 'drivers', timestamps: false, underscored: true })
export class Driver extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Column(DataType.CHAR(36))
  declare userId: string | null;

  @Column(DataType.STRING(120))
  declare fullName: string;

  @ForeignKey(() => VehicleType)
  @Column(DataType.CHAR(36))
  declare vehicleTypeId: string;

  @BelongsTo(() => VehicleType)
  declare vehicleType?: VehicleType;

  @Column(DataType.DECIMAL(10, 7))
  declare lat: string;

  @Column(DataType.DECIMAL(10, 7))
  declare lng: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isAvailable: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isOnline: boolean;

  @Column(DataType.DATE)
  declare onlineSince: Date | null;

  @Column(DataType.DATE)
  declare lastSeenAt: Date | null;
}
