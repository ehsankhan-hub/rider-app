import 'reflect-metadata';
import { sequelize } from './database';
import { VehicleType } from '../models/vehicle-type.model';
import { Driver } from '../models/driver.model';

async function seed(): Promise<void> {
  await sequelize.authenticate();

  const types = [
    {
      code: 'economy',
      displayName: 'Economy',
      baseFare: '5.00',
      perKm: '1.60',
      perMinute: '0.40',
      capacity: 4,
      isActive: true,
    },
    {
      code: 'comfort',
      displayName: 'Comfort',
      baseFare: '7.00',
      perKm: '2.20',
      perMinute: '0.55',
      capacity: 4,
      isActive: true,
    },
    {
      code: 'xl',
      displayName: 'XL',
      baseFare: '9.00',
      perKm: '2.80',
      perMinute: '0.70',
      capacity: 6,
      isActive: true,
    },
  ];

  for (const t of types) {
    const existing = await VehicleType.findOne({ where: { code: t.code } });
    if (!existing) {
      await VehicleType.create(t);
    }
  }

  const economy = await VehicleType.findOne({ where: { code: 'economy' } });
  const comfort = await VehicleType.findOne({ where: { code: 'comfort' } });
  if (economy && (await Driver.count()) === 0) {
    await Driver.bulkCreate([
      {
        fullName: 'Amina Haddad',
        vehicleTypeId: economy.id,
        lat: '24.7136',
        lng: '46.6753',
        isAvailable: true,
      },
      {
        fullName: 'Omar Nasser',
        vehicleTypeId: economy.id,
        lat: '24.7200',
        lng: '46.6700',
        isAvailable: true,
      },
      {
        fullName: 'Layla Faris',
        vehicleTypeId: comfort!.id,
        lat: '24.7100',
        lng: '46.6800',
        isAvailable: true,
      },
    ]);
  }

  console.log('Ride seed complete');
  await sequelize.close();
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
