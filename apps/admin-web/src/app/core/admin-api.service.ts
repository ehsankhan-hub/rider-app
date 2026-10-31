import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { env } from './env';

export interface PlaceHit {
  id: string;
  label: string;
  lat: number;
  lng: number;
  region?: string;
  country?: string;
  countryCode?: string;
}

export interface CityRecord {
  id: string;
  stateId: string;
  name: string;
  lat: string;
  lng: string;
  timezone: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface StateRecord {
  id: string;
  countryId: string;
  name: string;
  isActive: boolean;
  cities?: CityRecord[];
}

export interface CountryRecord {
  id: string;
  name: string;
  isoCode: string;
  isActive: boolean;
  states?: StateRecord[];
}

export interface CurrencyRecord {
  id: string;
  code: string;
  symbol: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface VehicleRecord {
  id: string;
  code: string;
  displayName: string;
  baseFare: string;
  perKm: string;
  perMinute: string;
  capacity: number;
  isActive: boolean;
}

export interface OperationsBoard {
  timezone: string;
  city: string;
  currency: string;
  date: string;
  live: { online: number; free: number; onTrip: number };
  window: { trips: number; completed: number; cancelled: number; open: number; fareAmount: number };
  byVehicle: Array<{
    code: string;
    name: string;
    online: number;
    free: number;
    onTrip: number;
    completed: number;
    fareAmount: number;
  }>;
  drivers: Array<{
    id: string;
    fullName: string;
    vehicleCode: string;
    vehicleName: string;
    isOnline: boolean;
    isAvailable: boolean;
    onTrip: boolean;
    onlineSince: string | null;
    lastSeenAt: string | null;
  }>;
  rides: Array<{
    id: string;
    status: string;
    paymentMethod: 'CASH' | 'WALLET';
    vehicleName: string;
    driverName: string;
    pickupAddress: string;
    dropoffAddress: string;
    fareAmount: string;
    distanceKm: string;
    durationMin: string;
    quoteFareAmount: string | null;
    quoteDistanceKm: string | null;
    quoteDurationMin: string | null;
    createdAt: string | null;
    endNote: string | null;
    reviewStatus: 'accepted' | 'rejected' | null;
    stopFromPickupKm: number | null;
    stopFromDropoffKm: number | null;
    elapsedSec: number | null;
    reviewHint: string | null;
    events: Array<{ status: string; note: string | null; createdAt: string | null }>;
  }>;
}

export interface AdminCatalog {
  countries: CountryRecord[];
  currencies: CurrencyRecord[];
  vehicles: VehicleRecord[];
  settings: { assignRadiusKm: number; openingWalletAmount: number; weekendDays: string };
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private readonly http: HttpClient) {}

  catalog() {
    return this.http.get<{ data: AdminCatalog }>(`${env.rideApi}/api/v1/admin/catalog`).pipe(map((r) => r.data));
  }

  searchPlaces(q: string, near?: { lat: number; lng: number }) {
    const params = new URLSearchParams({ q, lang: 'en' });
    if (near) {
      params.set('lat', String(near.lat));
      params.set('lng', String(near.lng));
    }
    return this.http
      .get<{ data: PlaceHit[] }>(`${env.rideApi}/api/v1/places?${params}`)
      .pipe(map((r) => r.data ?? []));
  }

  createCountry(body: { name: string; isoCode: string }) {
    return this.http.post(`${env.rideApi}/api/v1/admin/countries`, body);
  }

  updateCountry(id: string, body: { name: string; isoCode: string; isActive: boolean }) {
    return this.http.patch(`${env.rideApi}/api/v1/admin/countries/${id}`, body);
  }

  createState(body: { countryId: string; name: string }) {
    return this.http.post(`${env.rideApi}/api/v1/admin/states`, body);
  }

  updateState(id: string, body: { name: string; isActive: boolean }) {
    return this.http.patch(`${env.rideApi}/api/v1/admin/states/${id}`, body);
  }

  createCity(body: {
    stateId: string;
    name: string;
    lat: number;
    lng: number;
    timezone: string;
    isDefault: boolean;
  }) {
    return this.http.post(`${env.rideApi}/api/v1/admin/cities`, body);
  }

  updateCity(
    id: string,
    body: { name?: string; lat?: number; lng?: number; timezone?: string; isActive?: boolean; isDefault?: boolean },
  ) {
    return this.http.patch(`${env.rideApi}/api/v1/admin/cities/${id}`, body);
  }

  createCurrency(body: { code: string; symbol: string; name: string; isDefault: boolean }) {
    return this.http.post(`${env.rideApi}/api/v1/admin/currencies`, body);
  }

  updateCurrency(id: string, body: { symbol?: string; name?: string; isActive?: boolean; isDefault?: boolean }) {
    return this.http.patch(`${env.rideApi}/api/v1/admin/currencies/${id}`, body);
  }

  updateSettings(body: { assignRadiusKm: number; openingWalletAmount: number; weekendDays: string }) {
    return this.http.put(`${env.rideApi}/api/v1/admin/settings`, body);
  }

  cancelRide(id: string) {
    return this.http.post(`${env.rideApi}/api/v1/admin/rides/${id}/cancel`, {});
  }

  reviewRide(id: string, decision: 'accepted' | 'rejected') {
    return this.http.post(`${env.rideApi}/api/v1/admin/rides/${id}/review`, { decision });
  }

  operations(date: string) {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.http
      .get<{ data: OperationsBoard }>(`${env.rideApi}/api/v1/admin/operations${params}`)
      .pipe(map((r) => r.data));
  }

  updateVehicle(
    id: string,
    body: { displayName: string; baseFare: number; perKm: number; perMinute: number; capacity: number; isActive: boolean },
  ) {
    return this.http.patch(`${env.rideApi}/api/v1/admin/vehicle-types/${id}`, body);
  }
}
