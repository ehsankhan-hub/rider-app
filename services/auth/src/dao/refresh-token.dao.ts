import { RefreshToken } from '../models/refresh-token.model';

export class RefreshTokenDao {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<RefreshToken> {
    return RefreshToken.create({ userId, tokenHash, expiresAt, revokedAt: null });
  }

  findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    return RefreshToken.findOne({
      where: { tokenHash, revokedAt: null },
    });
  }

  async revoke(id: string): Promise<void> {
    await RefreshToken.update({ revokedAt: new Date() }, { where: { id } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });
  }
}
