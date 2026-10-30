import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { VehicleTypeDao } from './dao/vehicle-type.dao';
import { WalletDao } from './dao/wallet.dao';
import { DriverDao } from './dao/driver.dao';
import { RideDao } from './dao/ride.dao';
import { CustomerProfileDao } from './dao/customer-profile.dao';
import { PricingService } from './services/pricing.service';
import { RouteService } from './services/route.service';
import { WalletService, WalletTopUpProvider } from './services/wallet.service';
import { DispatchService } from './services/dispatch.service';
import { RideService } from './services/ride.service';
import { RideController } from './controllers/ride.controller';
import { WalletController } from './controllers/wallet.controller';
import { PlacesController } from './controllers/places.controller';
import { NearbyCarsController } from './controllers/nearby-cars.controller';
import { PlacesService } from './services/places.service';
import { NearbyCarsService } from './services/nearby-cars.service';
import { DriverService } from './services/driver.service';
import { DriverController } from './controllers/driver.controller';
import { CatalogService } from './services/catalog.service';
import { CatalogController } from './controllers/catalog.controller';
import { OperationsService } from './services/operations.service';
import { OperationsController } from './controllers/operations.controller';
import { RegionDao } from './dao/region.dao';
import { CurrencyDao } from './dao/currency.dao';
import { SettingsDao } from './dao/settings.dao';
import { createRideRouter } from './routes/ride.routes';
import { errorMiddleware } from './middlewares/error.middleware';
import { RideEvents } from './sockets/ride-events';

export function createApp(rideEvents: RideEvents) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  const vehicleTypeDao = new VehicleTypeDao();
  const walletDao = new WalletDao();
  const driverDao = new DriverDao();
  const rideDao = new RideDao();

  const catalogService = new CatalogService(new RegionDao(), new CurrencyDao(), new SettingsDao(), vehicleTypeDao);
  const routeService = new RouteService();
  const pricingService = new PricingService(vehicleTypeDao, routeService, catalogService);
  const walletService = new WalletService(walletDao, new WalletTopUpProvider(), catalogService);
  const dispatchService = new DispatchService(driverDao);
  const rideService = new RideService(
    rideDao,
    vehicleTypeDao,
    driverDao,
    pricingService,
    dispatchService,
    walletService,
    rideEvents,
    catalogService,
    new CustomerProfileDao(),
  );

  const rideController = new RideController(rideService);
  const walletController = new WalletController(walletService);
  const placesController = new PlacesController(new PlacesService());
  const nearbyCarsController = new NearbyCarsController(new NearbyCarsService(driverDao, catalogService));
  const driverService = new DriverService(driverDao, rideDao, vehicleTypeDao, rideEvents, catalogService, rideService);
  const driverController = new DriverController(driverService, rideService, routeService);
  const catalogController = new CatalogController(catalogService);
  const operationsController = new OperationsController(new OperationsService(driverDao, rideDao, catalogService));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ride-api' }));
  app.use(
    '/api/v1',
    createRideRouter(
      rideController,
      walletController,
      placesController,
      nearbyCarsController,
      driverController,
      catalogController,
      operationsController,
    ),
  );
  app.use(errorMiddleware);
  return app;
}
