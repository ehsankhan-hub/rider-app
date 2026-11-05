import { Router } from 'express';
import { RideController } from '../controllers/ride.controller';
import { WalletController } from '../controllers/wallet.controller';
import { PlacesController } from '../controllers/places.controller';
import { NearbyCarsController } from '../controllers/nearby-cars.controller';
import { DriverController } from '../controllers/driver.controller';
import { CatalogController } from '../controllers/catalog.controller';
import { OperationsController } from '../controllers/operations.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export function createRideRouter(
  rideController: RideController,
  walletController: WalletController,
  placesController: PlacesController,
  nearbyCarsController: NearbyCarsController,
  driverController: DriverController,
  catalogController: CatalogController,
  operationsController: OperationsController,
): Router {
  const router = Router();
  router.get('/vehicle-types', rideController.vehicleTypes);
  router.get('/places', placesController.search);
  router.get('/places/reverse', placesController.reverse);
  router.use(authMiddleware);
  router.get('/config', catalogController.config);
  router.get('/admin/catalog', catalogController.adminCatalog);
  router.get('/admin/operations', operationsController.board);
  router.post('/admin/rides/:id/cancel', rideController.adminCancel);
  router.post('/admin/rides/:id/review', rideController.adminReview);
  router.post('/admin/countries', catalogController.createCountry);
  router.patch('/admin/countries/:id', catalogController.updateCountry);
  router.post('/admin/states', catalogController.createState);
  router.patch('/admin/states/:id', catalogController.updateState);
  router.post('/admin/cities', catalogController.createCity);
  router.patch('/admin/cities/:id', catalogController.updateCity);
  router.post('/admin/currencies', catalogController.createCurrency);
  router.patch('/admin/currencies/:id', catalogController.updateCurrency);
  router.put('/admin/settings', catalogController.updateSettings);
  router.patch('/admin/vehicle-types/:id', catalogController.updateVehicle);
  router.get('/nearby-cars', nearbyCarsController.list);
  router.post('/quotes', rideController.quote);
  router.post('/rides', rideController.create);
  router.post('/me/country', rideController.rememberCountry);
  router.get('/rides', rideController.list);
  router.get('/rides/:id', rideController.get);
  router.post('/rides/:id/cancel', rideController.cancel);
  router.get('/driver/summary', driverController.summary);
  router.post('/driver/vehicle', driverController.registerVehicle);
  router.post('/driver/online', driverController.online);
  router.post('/driver/offline', driverController.offline);
  router.get('/driver/route', driverController.route);
  router.post('/driver/location', driverController.location);
  router.get('/driver/active', driverController.active);
  router.post('/rides/:id/pass', driverController.pass);
  router.post('/rides/:id/no-show', driverController.noShow);
  router.post('/rides/:id/status', driverController.status);
  router.get('/wallet', walletController.get);
  router.post('/wallet/top-up', walletController.topUp);
  return router;
}
