import { Wallet } from '../models/wallet.model';
import { WalletTransaction } from '../models/wallet-transaction.model';
import { sequelize } from '../config/database';

export class WalletDao {
  findByUserId(userId: string): Promise<Wallet | null> {
    return Wallet.findOne({ where: { userId } });
  }

  create(userId: string, openingBalance = 0, currency = 'USD'): Promise<Wallet> {
    return Wallet.create({ userId, balance: openingBalance.toFixed(2), currency });
  }

  listTransactions(walletId: string): Promise<WalletTransaction[]> {
    return WalletTransaction.findAll({
      where: { walletId },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
  }

  async credit(walletId: string, amount: number, type: 'TOPUP' | 'REFUND', reference?: string): Promise<Wallet> {
    return sequelize.transaction(async (t) => {
      const wallet = await Wallet.findByPk(walletId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      const next = Number(wallet.balance) + amount;
      wallet.balance = next.toFixed(2);
      await wallet.save({ transaction: t });
      await WalletTransaction.create(
        { walletId, type, amount: amount.toFixed(2), reference: reference ?? null },
        { transaction: t },
      );
      return wallet;
    });
  }

  async debit(walletId: string, amount: number, reference?: string): Promise<Wallet> {
    return sequelize.transaction(async (t) => {
      const wallet = await Wallet.findByPk(walletId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      const current = Number(wallet.balance);
      if (current < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }
      wallet.balance = (current - amount).toFixed(2);
      await wallet.save({ transaction: t });
      await WalletTransaction.create(
        { walletId, type: 'RIDE_DEBIT', amount: amount.toFixed(2), reference: reference ?? null },
        { transaction: t },
      );
      return wallet;
    });
  }
}
