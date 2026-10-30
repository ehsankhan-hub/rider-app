import { Table, Column, Model, DataType, PrimaryKey, Default, Unique } from 'sequelize-typescript';

@Table({ tableName: 'customer_profiles', timestamps: true, underscored: true })
export class CustomerProfile extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Unique
  @Column(DataType.CHAR(36))
  declare userId: string;

  @Column(DataType.STRING(120))
  declare fullName: string;
}
