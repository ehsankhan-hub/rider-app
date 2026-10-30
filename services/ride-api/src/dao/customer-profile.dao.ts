import { CustomerProfile } from '../models/customer-profile.model';

export class CustomerProfileDao {
  findByUserId(userId: string): Promise<CustomerProfile | null> {
    return CustomerProfile.findOne({ where: { userId } });
  }

  create(userId: string, fullName: string): Promise<CustomerProfile> {
    return CustomerProfile.create({ userId, fullName });
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
