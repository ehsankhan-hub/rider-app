import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { env } from './env';

export interface VehicleType {
  id: string;
  code: string;
  displayName: string;
  capacity: number;
}

export interface FareQuote {
  vehicleTypeId: string;
  vehicleCode: string;
  displayName: string;
  distanceKm: number;
  durationMin: number;
  freeFlowMin: number;
  trafficBand: 'light' | 'normal' | 'busy' | 'peak';
  fareFactor: number;
  fareAmount: number;
  currency: string;
  route: Array<[number, number]>;
}

export interface PlaceHit {
  id: string;
  label: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface NearbyCar {
  id: string;
  vehicleCode: 'economy' | 'comfort' | 'xl';
  displayName: string;
  lat: number;
  lng: number;
  heading: number;
  etaMin: number;
}

export interface RuntimeConfig {
  currency: { code: string; symbol: string; name: string };
  city: { id: string; name: string; lat: number; lng: number; timezone: string; state: string; country: string };
  assignRadiusKm: number;
  openingWalletAmount: number;
}

export interface Ride {
  id: string;
  status: string;
  paymentMethod: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareAmount: string;
  distanceKm: string;
  driver?: { fullName: string } | null;
}

@Injectable({ providedIn: 'root' })
export class RideApiService {
  constructor(private readonly http: HttpClient) {}

  runtime() {
    return this.http.get<{ data: RuntimeConfig }>(`${env.rideApi}/api/v1/config`).pipe(map((r) => r.data));
  }

  searchPlaces(q: string, lat: number | undefined, lng: number | undefined, lang: 'en' | 'ar') {
    let params = new HttpParams().set('q', q).set('lang', lang);
    if (lat !== undefined && lng !== undefined) {
      params = params.set('lat', String(lat)).set('lng', String(lng));
    }
    return this.http
      .get<{ data: PlaceHit[] }>(`${env.rideApi}/api/v1/places`, { params })
      .pipe(map((r) => r.data));
  }

  reversePlace(lat: number, lng: number, lang: 'en' | 'ar') {
    const params = new HttpParams().set('lat', String(lat)).set('lng', String(lng)).set('lang', lang);
    return this.http
      .get<{ data: PlaceHit | null }>(`${env.rideApi}/api/v1/places/reverse`, { params })
      .pipe(map((r) => r.data));
  }

  nearbyCars(lat: number, lng: number) {
    const params = new HttpParams().set('lat', String(lat)).set('lng', String(lng));
    return this.http
      .get<{ data: NearbyCar[] }>(`${env.rideApi}/api/v1/nearby-cars`, { params })
      .pipe(map((r) => r.data));
  }

  vehicleTypes() {
    return this.http
      .get<{ data: VehicleType[] }>(`${env.rideApi}/api/v1/vehicle-types`)
      .pipe(map((r) => r.data));
  }

  quote(body: {
    vehicleTypeId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }) {
    return this.http
      .post<{ data: FareQuote }>(`${env.rideApi}/api/v1/quotes`, body)
      .pipe(map((r) => r.data));
  }

  createRide(body: Record<string, unknown>) {
    return this.http.post<{ data: Ride }>(`${env.rideApi}/api/v1/rides`, body).pipe(map((r) => r.data));
  }

  listRides() {
    return this.http.get<{ data: Ride[] }>(`${env.rideApi}/api/v1/rides`).pipe(map((r) => r.data));
  }

  cancel(id: string) {
    return this.http
      .post<{ data: Ride }>(`${env.rideApi}/api/v1/rides/${id}/cancel`, {})
      .pipe(map((r) => r.data));
  }

  wallet() {
    return this.http.get<{ data: unknown }>(`${env.rideApi}/api/v1/wallet`).pipe(map((r) => r.data));
  }

  topUp(amount: number) {
    return this.http
      .post<{ data: unknown }>(`${env.rideApi}/api/v1/wallet/top-up`, { amount })
      .pipe(map((r) => r.data));
  }
}
