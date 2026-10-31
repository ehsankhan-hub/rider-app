import { UniqueConstraintError } from 'sequelize';
import { CurrencyDao } from '../dao/currency.dao';
import { RegionDao } from '../dao/region.dao';
import { SettingsDao } from '../dao/settings.dao';
import { VehicleTypeDao } from '../dao/vehicle-type.dao';
import { City, Country, State } from '../models/region.models';
import { Currency } from '../models/currency.model';
import { VehicleType } from '../models/vehicle-type.model';
import { AppError } from '../utils/app-error';
import { countryIsoAt, timezoneForCountry } from './service-area';

export interface RuntimeConfig {
  currency: { code: string; symbol: string; name: string };
  city: { id: string; name: string; lat: number; lng: number; timezone: string; state: string; country: string };
  assignRadiusKm: number;
  openingWalletAmount: number;
  weekendDays: string[];
}

const FALLBACK: RuntimeConfig = {
  currency: { code: 'USD', symbol: '$', name: 'US Dollar' },
  city: {
    id: '',
    name: 'Riyadh',
    lat: 24.7136,
    lng: 46.6753,
    timezone: 'Asia/Riyadh',
    state: 'Riyadh Region',
    country: 'Saudi Arabia',
  },
  assignRadiusKm: 25,
  openingWalletAmount: 25,
  weekendDays: ['Fri', 'Sat'],
};

export class CatalogService {
  constructor(
    private readonly regions: RegionDao,
    private readonly currencies: CurrencyDao,
    private readonly settings: SettingsDao,
    private readonly vehicleTypes: VehicleTypeDao,
  ) {}

  /** Both countries stay open until an admin clears Active on that country. */
  async assertServiceOpen(lat: number, lng: number): Promise<void> {
    const iso = countryIsoAt(lat, lng);
    if (!iso) return;
    const country = await this.regions.findCountryByIso(iso);
    if (country && !country.isActive) {
      throw new AppError(403, `${country.name} is turned off`, 'COUNTRY_CLOSED');
    }
  }

  timezoneAt(lat: number, lng: number, fallback: string): string {
    return timezoneForCountry(countryIsoAt(lat, lng), fallback);
  }

  async runtime(): Promise<RuntimeConfig> {
    const [city, currency, stored] = await Promise.all([
      this.regions.findServiceCity(),
      this.currencies.findDefault(),
      this.settings.read(),
    ]);
    const radius = Number(stored['assign_radius_km']);
    const opening = Number(stored['opening_wallet_amount']);
    const weekendDays = (stored['weekend_days'] ?? 'Fri,Sat')
      .split(',')
      .map((day) => day.trim())
      .filter((day) => day.length > 0);
    return {
      currency: currency
        ? { code: currency.code, symbol: currency.symbol, name: currency.name }
        : FALLBACK.currency,
      city: city ? this.toRuntimeCity(city) : FALLBACK.city,
      assignRadiusKm: Number.isFinite(radius) && radius > 0 ? radius : FALLBACK.assignRadiusKm,
      openingWalletAmount: Number.isFinite(opening) && opening >= 0 ? opening : FALLBACK.openingWalletAmount,
      weekendDays: weekendDays.length > 0 ? weekendDays : FALLBACK.weekendDays,
    };
  }

  async adminCatalog() {
    const [countries, currencies, stored, vehicles] = await Promise.all([
      this.regions.listCountries(),
      this.currencies.list(),
      this.settings.read(),
      this.vehicleTypes.findAll(),
    ]);
    const runtime = await this.runtime();
    return {
      countries,
      currencies,
      vehicles,
      settings: {
        assignRadiusKm: runtime.assignRadiusKm,
        openingWalletAmount: runtime.openingWalletAmount,
        weekendDays: runtime.weekendDays.join(','),
      },
      stored,
    };
  }

  async createCountry(input: { name: string; isoCode: string; isActive: boolean }): Promise<Country> {
    return this.guardUnique(
      () => this.regions.createCountry({ ...input, isoCode: input.isoCode.toUpperCase() }),
      'That country code already exists',
    );
  }

  async updateCountry(id: string, input: { name?: string; isoCode?: string; isActive?: boolean }): Promise<Country> {
    const country = await this.requireCountry(id);
    if (input.name !== undefined) country.name = input.name;
    if (input.isoCode !== undefined) country.isoCode = input.isoCode.toUpperCase();
    if (input.isActive !== undefined) country.isActive = input.isActive;
    return this.guardUnique(() => this.regions.saveCountry(country), 'That country code already exists');
  }

  async createState(input: { countryId: string; name: string; isActive: boolean }): Promise<State> {
    await this.requireCountry(input.countryId);
    return this.regions.createState(input);
  }

  async updateState(id: string, input: { name?: string; isActive?: boolean }): Promise<State> {
    const state = await this.requireState(id);
    if (input.name !== undefined) state.name = input.name;
    if (input.isActive !== undefined) state.isActive = input.isActive;
    return this.regions.saveState(state);
  }

  async createCity(input: {
    stateId: string;
    name: string;
    lat: number;
    lng: number;
    timezone: string;
    isActive: boolean;
    isDefault: boolean;
  }): Promise<City> {
    await this.requireState(input.stateId);
    this.assertTimezone(input.timezone);
    if (input.isDefault) await this.regions.clearDefaultCity();
    return this.regions.createCity({
      ...input,
      lat: input.lat.toFixed(7),
      lng: input.lng.toFixed(7),
    });
  }

  async updateCity(
    id: string,
    input: {
      name?: string;
      lat?: number;
      lng?: number;
      timezone?: string;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ): Promise<City> {
    const city = await this.requireCity(id);
    if (input.timezone !== undefined) this.assertTimezone(input.timezone);
    if (input.isDefault) await this.regions.clearDefaultCity();
    if (input.name !== undefined) city.name = input.name;
    if (input.lat !== undefined) city.lat = input.lat.toFixed(7);
    if (input.lng !== undefined) city.lng = input.lng.toFixed(7);
    if (input.timezone !== undefined) city.timezone = input.timezone;
    if (input.isActive !== undefined) city.isActive = input.isActive;
    if (input.isDefault !== undefined) city.isDefault = input.isDefault;
    return this.regions.saveCity(city);
  }

  async createCurrency(input: {
    code: string;
    symbol: string;
    name: string;
    isActive: boolean;
    isDefault: boolean;
  }): Promise<Currency> {
    if (input.isDefault) await this.currencies.clearDefault();
    return this.guardUnique(
      () => this.currencies.create({ ...input, code: input.code.toUpperCase() }),
      'That currency code already exists',
    );
  }

  async updateCurrency(
    id: string,
    input: { symbol?: string; name?: string; isActive?: boolean; isDefault?: boolean },
  ): Promise<Currency> {
    const currency = await this.currencies.findById(id);
    if (!currency) throw new AppError(404, 'Currency not found', 'CURRENCY_NOT_FOUND');
    if (input.isDefault) await this.currencies.clearDefault();
    if (input.symbol !== undefined) currency.symbol = input.symbol;
    if (input.name !== undefined) currency.name = input.name;
    if (input.isActive !== undefined) currency.isActive = input.isActive;
    if (input.isDefault !== undefined) currency.isDefault = input.isDefault;
    return this.currencies.save(currency);
  }

  async updateSettings(input: {
    assignRadiusKm: number;
    openingWalletAmount: number;
    weekendDays: string;
  }): Promise<void> {
    await this.settings.write({
      assign_radius_km: String(input.assignRadiusKm),
      opening_wallet_amount: String(input.openingWalletAmount),
      weekend_days: input.weekendDays,
    });
  }

  async updateVehicle(
    id: string,
    input: {
      displayName?: string;
      baseFare?: number;
      perKm?: number;
      perMinute?: number;
      capacity?: number;
      isActive?: boolean;
    },
  ): Promise<VehicleType> {
    const vehicle = await this.vehicleTypes.findById(id);
    if (!vehicle) throw new AppError(404, 'Vehicle type not found', 'VEHICLE_TYPE_NOT_FOUND');
    if (input.displayName !== undefined) vehicle.displayName = input.displayName;
    if (input.baseFare !== undefined) vehicle.baseFare = input.baseFare.toFixed(2);
    if (input.perKm !== undefined) vehicle.perKm = input.perKm.toFixed(2);
    if (input.perMinute !== undefined) vehicle.perMinute = input.perMinute.toFixed(2);
    if (input.capacity !== undefined) vehicle.capacity = input.capacity;
    if (input.isActive !== undefined) vehicle.isActive = input.isActive;
    return this.vehicleTypes.save(vehicle);
  }

  private async requireCountry(id: string): Promise<Country> {
    const country = await this.regions.findCountry(id);
    if (!country) throw new AppError(404, 'Country not found', 'COUNTRY_NOT_FOUND');
    return country;
  }

  private async requireState(id: string): Promise<State> {
    const state = await this.regions.findState(id);
    if (!state) throw new AppError(404, 'State not found', 'STATE_NOT_FOUND');
    return state;
  }

  private async requireCity(id: string): Promise<City> {
    const city = await this.regions.findCity(id);
    if (!city) throw new AppError(404, 'City not found', 'CITY_NOT_FOUND');
    return city;
  }

  private assertTimezone(timeZone: string): void {
    try {
      Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    } catch {
      throw new AppError(400, 'Timezone is not recognized. Use a value such as Asia/Kolkata.', 'INVALID_TIMEZONE');
    }
  }

  private async guardUnique<T>(work: () => Promise<T>, message: string): Promise<T> {
    try {
      return await work();
    } catch (err) {
      if (err instanceof UniqueConstraintError) throw new AppError(409, message, 'ALREADY_EXISTS');
      throw err;
    }
  }

  private toRuntimeCity(city: City): RuntimeConfig['city'] {
    return {
      id: city.id,
      name: city.name,
      lat: Number(city.lat),
      lng: Number(city.lng),
      timezone: city.timezone,
      state: city.state?.name ?? '',
      country: city.state?.country?.name ?? '',
    };
  }
}
