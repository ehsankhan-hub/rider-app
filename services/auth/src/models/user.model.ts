import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  Unique,
  HasMany,
} from 'sequelize-typescript';
import { RefreshToken } from './refresh-token.model';

export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @Unique
  @Column(DataType.STRING(255))
  declare email: string;

  @Unique
  @Column(DataType.STRING(32))
  declare phone: string;

  @Column(DataType.STRING(255))
  declare passwordHash: string;

  @Column(DataType.STRING(120))
  declare fullName: string;

  @Default('CUSTOMER')
  @Column(DataType.ENUM('CUSTOMER', 'DRIVER', 'ADMIN'))
  declare role: UserRole;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @HasMany(() => RefreshToken)
  refreshTokens?: RefreshToken[];
}
