import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  HasMany,
  Unique,
} from 'sequelize-typescript';

@Table({ tableName: 'countries', timestamps: false, underscored: true })
export class Country extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Column(DataType.STRING(80))
  declare name: string;

  @Unique
  @Column(DataType.CHAR(2))
  declare isoCode: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @HasMany(() => State, { as: 'states' })
  declare states?: State[];
}

@Table({ tableName: 'states', timestamps: false, underscored: true })
export class State extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @ForeignKey(() => Country)
  @Column(DataType.CHAR(36))
  declare countryId: string;

  @BelongsTo(() => Country, { as: 'country' })
  declare country?: Country;

  @Column(DataType.STRING(80))
  declare name: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @HasMany(() => City, { as: 'cities' })
  declare cities?: City[];
}

@Table({ tableName: 'cities', timestamps: false, underscored: true })
export class City extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @ForeignKey(() => State)
  @Column(DataType.CHAR(36))
  declare stateId: string;

  @BelongsTo(() => State, { as: 'state' })
  declare state?: State;

  @Column(DataType.STRING(80))
  declare name: string;

  @Column(DataType.DECIMAL(10, 7))
  declare lat: string;

  @Column(DataType.DECIMAL(10, 7))
  declare lng: string;

  @Column(DataType.STRING(64))
  declare timezone: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isDefault: boolean;
}
