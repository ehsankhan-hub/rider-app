import { Table, Column, Model, DataType, PrimaryKey, Default, Unique } from 'sequelize-typescript';

@Table({ tableName: 'currencies', timestamps: false, underscored: true })
export class Currency extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Unique
  @Column(DataType.CHAR(3))
  declare code: string;

  @Column(DataType.STRING(8))
  declare symbol: string;

  @Column(DataType.STRING(80))
  declare name: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isDefault: boolean;
}
