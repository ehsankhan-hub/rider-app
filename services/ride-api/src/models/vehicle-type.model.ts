import { Table, Column, Model, DataType, PrimaryKey, Default, Unique } from 'sequelize-typescript';

@Table({ tableName: 'vehicle_types', timestamps: false, underscored: true })
export class VehicleType extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Unique
  @Column(DataType.STRING(32))
  declare code: string;

  @Column(DataType.STRING(80))
  declare displayName: string;

  @Column(DataType.DECIMAL(10, 2))
  declare baseFare: string;

  @Column(DataType.DECIMAL(10, 2))
  declare perKm: string;

  @Column(DataType.DECIMAL(10, 2))
  declare perMinute: string;

  @Column(DataType.INTEGER)
  declare capacity: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;
}
