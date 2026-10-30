import { WalletDao } from '../dao/wallet.dao';
import { AppError } from '../utils/app-error';
import { CatalogService } from './catalog.service';

export class WalletTopUpProvider {
  async authorize(amount: number): Promise<{ reference: string }> {
    if (amount <= 0) {
      throw new AppError(400, 'Amount must be positive', 'INVALID_AMOUNT');
    }
    return { reference: `topup_${Date.now()}` };
  }
}

export class WalletService {
  constructor(
    private readonly walletDao: WalletDao,
    private readonly topUpProvider: WalletTopUpProvider,
    private readonly catalogService: CatalogService,
  ) {}

  async ensureWallet(userId: string) {
    const existing = await this.walletDao.findByUserId(userId);
    if (existing) return existing;
    const runtime = await this.catalogService.runtime();
    return this.walletDao.create(userId, runtime.openingWalletAmount, runtime.currency.code);
  }

  async getForUser(userId: string) {
    const wallet = await this.ensureWallet(userId);
    const transactions = await this.walletDao.listTransactions(wallet.id);
    return { wallet, transactions };
  }

  async topUp(userId: string, amount: number) {
    const wallet = await this.ensureWallet(userId);
    const { reference } = await this.topUpProvider.authorize(amount);
    const updated = await this.walletDao.credit(wallet.id, amount, 'TOPUP', reference);
    return updated;
  }

  async debitForRide(userId: string, amount: number, rideId: string) {
    const wallet = await this.ensureWallet(userId);
    try {
      return await this.walletDao.debit(wallet.id, amount, rideId);
    } catch (err) {
      if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
        throw new AppError(402, 'Insufficient wallet balance', 'INSUFFICIENT_FUNDS');
      }
      throw err;
    }
  }

  async refundRide(userId: string, amount: number, rideId: string) {
    const wallet = await this.ensureWallet(userId);
    return this.walletDao.credit(wallet.id, amount, 'REFUND', rideId);
  }
}
