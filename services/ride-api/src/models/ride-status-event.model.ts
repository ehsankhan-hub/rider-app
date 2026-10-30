import { Table, Column, Model, DataType, PrimaryKey, Default, ForeignKey, BelongsTo, CreatedAt } from 'sequelize-typescript';
import { Ride } from './ride.model';

@Table({ tableName: 'ride_status_events', timestamps: true, underscored: true, updatedAt: false })
export class RideStatusEvent extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @ForeignKey(() => Ride)
  @Column(DataType.CHAR(36))
  declare rideId: string;

  @BelongsTo(() => Ride)
  ride?: Ride;

  @Column(DataType.STRING(32))
  declare status: string;

  @Column(DataType.STRING(255))
  declare note: string | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;
}
