import { Sequelize } from 'sequelize-typescript';
import { env } from './env';
import { VehicleType } from '../models/vehicle-type.model';
import { Wallet } from '../models/wallet.model';
import { WalletTransaction } from '../models/wallet-transaction.model';
import { Driver } from '../models/driver.model';
import { Ride } from '../models/ride.model';
import { RideStatusEvent } from '../models/ride-status-event.model';
import { CustomerProfile } from '../models/customer-profile.model';
import { City, Country, State } from '../models/region.models';
import { Currency } from '../models/currency.model';
import { PlatformSetting } from '../models/platform-setting.model';

export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  logging: false,
  models: [
    VehicleType,
    Wallet,
    WalletTransaction,
    Driver,
    Ride,
    RideStatusEvent,
    CustomerProfile,
    Country,
    State,
    City,
    Currency,
    PlatformSetting,
  ],
});
