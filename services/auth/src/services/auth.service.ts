import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserDao } from '../dao/user.dao';
import { RefreshTokenDao } from '../dao/refresh-token.dao';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';
import { LoginDto, RegisterDto } from '../dtos/auth.dto';
import { User } from '../models/user.model';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class AuthService {
  constructor(
    private readonly userDao: UserDao,
    private readonly refreshTokenDao: RefreshTokenDao,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: ReturnType<AuthService['toPublicUser']>; tokens: TokenPair }> {
    const existingEmail = await this.userDao.findByEmail(dto.email.toLowerCase());
    if (existingEmail) {
      throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');
    }
    const existingPhone = await this.userDao.findByPhone(dto.phone);
    if (existingPhone) {
      throw new AppError(409, 'Phone already registered', 'PHONE_TAKEN');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userDao.create({
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
    });

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<{ user: ReturnType<AuthService['toPublicUser']>; tokens: TokenPair }> {
    const user = await this.userDao.findByEmail(dto.email.toLowerCase());
    if (!user || !user.isActive) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }
    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenDao.findValidByHash(tokenHash);
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH');
    }
    const user = await this.userDao.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH');
    }
    await this.refreshTokenDao.revoke(stored.id);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenDao.findValidByHash(tokenHash);
    if (stored) {
      await this.refreshTokenDao.revoke(stored.id);
    }
  }

  async me(userId: string) {
    const user = await this.userDao.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }
    return this.toPublicUser(user);
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      env.jwt.accessSecret,
      { expiresIn: env.jwt.accessExpires } as jwt.SignOptions,
    );
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const days = 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.refreshTokenDao.create(user.id, this.hashToken(refreshToken), expiresAt);
    return { accessToken, refreshToken, expiresIn: env.jwt.accessExpires };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
