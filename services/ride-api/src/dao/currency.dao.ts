import { Currency } from '../models/currency.model';

export class CurrencyDao {
  list(): Promise<Currency[]> {
    return Currency.findAll({ order: [['code', 'ASC']] });
  }

  findById(id: string): Promise<Currency | null> {
    return Currency.findByPk(id);
  }

  findDefault(): Promise<Currency | null> {
    return Currency.findOne({ where: { isDefault: true, isActive: true } });
  }

  create(data: { code: string; symbol: string; name: string; isActive: boolean; isDefault: boolean }): Promise<Currency> {
    return Currency.create(data);
  }

  async clearDefault(): Promise<void> {
    await Currency.update({ isDefault: false }, { where: { isDefault: true } });
  }

  save(currency: Currency): Promise<Currency> {
    return currency.save();
  }
}
