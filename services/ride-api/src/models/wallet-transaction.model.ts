import { Table, Column, Model, DataType, PrimaryKey, Default, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Wallet } from './wallet.model';

@Table({ tableName: 'wallet_transactions', timestamps: true, underscored: true, updatedAt: false })
export class WalletTransaction extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @ForeignKey(() => Wallet)
  @Column(DataType.CHAR(36))
  declare walletId: string;

  @BelongsTo(() => Wallet)
  wallet?: Wallet;

  @Column(DataType.ENUM('TOPUP', 'RIDE_DEBIT', 'REFUND'))
  declare type: 'TOPUP' | 'RIDE_DEBIT' | 'REFUND';

  @Column(DataType.DECIMAL(12, 2))
  declare amount: string;

  @Column(DataType.STRING(64))
  declare reference: string | null;
}
