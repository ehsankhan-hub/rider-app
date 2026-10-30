import { Sequelize } from 'sequelize-typescript';
import { env } from './env';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refresh-token.model';

export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  logging: false,
  models: [User, RefreshToken],
});
