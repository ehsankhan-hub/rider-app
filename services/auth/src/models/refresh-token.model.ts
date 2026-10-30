import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';

@Table({
  tableName: 'refresh_tokens',
  timestamps: true,
  underscored: true,
  updatedAt: false,
})
export class RefreshToken extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.CHAR(36))
  declare id: string;

  @ForeignKey(() => User)
  @Column(DataType.CHAR(36))
  declare userId: string;

  @BelongsTo(() => User)
  user?: User;

  @Column(DataType.STRING(255))
  declare tokenHash: string;

  @Column(DataType.DATE)
  declare expiresAt: Date;

  @Column(DataType.DATE)
  declare revokedAt: Date | null;
}
