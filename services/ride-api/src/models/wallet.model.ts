import { Table, Column, Model, DataType, PrimaryKey, Default, Unique, HasMany } from 'sequelize-typescript';
import { WalletTransaction } from './wallet-transaction.model';

@Table({ tableName: 'wallets', timestamps: true, underscored: true })
export class Wallet extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Unique
  @Column(DataType.CHAR(36))
  declare userId: string;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  declare balance: string;

  @Default('USD')
  @Column(DataType.CHAR(3))
  declare currency: string;

  @HasMany(() => WalletTransaction)
  transactions?: WalletTransaction[];
}
