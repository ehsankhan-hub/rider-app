import { CustomerProfile } from '../models/customer-profile.model';

export class CustomerProfileDao {
  findByUserId(userId: string): Promise<CustomerProfile | null> {
    return CustomerProfile.findOne({ where: { userId } });
  }

  create(userId: string, fullName: string): Promise<CustomerProfile> {
    return CustomerProfile.create({ userId, fullName });
  }

  list(): Promise<CustomerProfile[]> {
    return CustomerProfile.findAll({ order: [['fullName', 'ASC']] });
  }

  async remember(userId: string, fullName: string | undefined, country: { iso: string; name: string } | null): Promise<void> {
    if (!country && !fullName) return;
    const existing = await this.findByUserId(userId);
    if (!existing) {
      await CustomerProfile.create({
        userId,
        fullName: fullName?.trim() || 'Customer',
        countryIso: country?.iso ?? null,
        countryName: country?.name ?? null,
      });
      return;
    }
    let dirty = false;
    if (fullName && existing.fullName !== fullName) {
      existing.fullName = fullName;
      dirty = true;
    }
    if (country && existing.countryIso !== country.iso) {
      existing.countryIso = country.iso;
      existing.countryName = country.name;
      dirty = true;
    }
    if (dirty) await existing.save();
  }

  async saveName(userId: string, fullName: string): Promise<void> {
    const existing = await this.findByUserId(userId);
    if (!existing) {
      await this.create(userId, fullName);
      return;
    }
    if (existing.fullName !== fullName) {
      existing.fullName = fullName;
      await existing.save();
    }
  }
}
