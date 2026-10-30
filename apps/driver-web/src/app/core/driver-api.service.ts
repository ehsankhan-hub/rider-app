import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { map } from 'rxjs';
import { env } from './env';
import { SessionService } from './session.service';

export interface VehicleType {
  id: string;
  code: string;
  displayName: string;
}

export interface DriverRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: string;
  pickupLng: string;
  dropoffLat: string;
  dropoffLng: string;
  fareAmount: string;
  paymentMethod?: 'CASH' | 'WALLET';
  distanceKm?: string;
  durationMin?: string;
  riderName?: string;
  driver?: { userId?: string | null };
}

export interface EarningsTrip {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareAmount: string;
  paymentMethod: string;
  distanceKm: string;
  completedAt: string;
}

export interface DriverSummary {
  currency: { code: string; symbol: string };
  isOnline: boolean;
  onlineSince: string | null;
  vehicleTypeId: string | null;
  vehicle: string | null;
  today: { trips: number; fare: string };
  week: { trips: number; fare: string };
  recent: EarningsTrip[];
}

@Injectable({ providedIn: 'root' })
export class DriverApiService {
  private readonly zone = inject(NgZone);
  private readonly session = inject(SessionService);
  private socket?: Socket;
  private watching = false;
  readonly liveRide = signal<DriverRide | null>(null);

  constructor(private readonly http: HttpClient) {
    this.session.listen(() => {
      if (this.watching && this.session.accessToken && !this.socket?.connected) this.open();
    });
  }

  runtime() {
    return this.http
      .get<{ data: { city: { lat: number; lng: number; name: string }; assignRadiusKm: number } }>(
        `${env.rideApi}/api/v1/config`,
      )
      .pipe(map((r) => r.data));
  }

  vehicleTypes() {
    return this.http.get<{ data: VehicleType[] }>(`${env.rideApi}/api/v1/vehicle-types`).pipe(map((r) => r.data));
  }

  registerVehicle(body: { vehicleTypeId: string; fullName: string }) {
    return this.http.post(`${env.rideApi}/api/v1/driver/vehicle`, body);
  }

  online(body: { lat: number; lng: number; fullName: string }) {
    return this.http
      .post<{ data: { activeRide: DriverRide | null } }>(`${env.rideApi}/api/v1/driver/online`, body)
      .pipe(map((r) => r.data));
  }

  offline() {
    return this.http.post(`${env.rideApi}/api/v1/driver/offline`, {});
  }

  location(lat: number, lng: number) {
    return this.http.post(`${env.rideApi}/api/v1/driver/location`, { lat, lng });
  }

  route(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const params = new HttpParams()
      .set('fromLat', String(fromLat))
      .set('fromLng', String(fromLng))
      .set('toLat', String(toLat))
      .set('toLng', String(toLng));
    return this.http
      .get<{ data: { coordinates: Array<[number, number]> } }>(`${env.rideApi}/api/v1/driver/route`, { params })
      .pipe(map((r) => r.data.coordinates));
  }

  active() {
    return this.http.get<{ data: DriverRide | null }>(`${env.rideApi}/api/v1/driver/active`).pipe(map((r) => r.data));
  }

  summary() {
    return this.http.get<{ data: DriverSummary }>(`${env.rideApi}/api/v1/driver/summary`).pipe(map((r) => r.data));
  }

  pass(id: string) {
    return this.http.post(`${env.rideApi}/api/v1/rides/${id}/pass`, {});
  }

  setStatus(
    id: string,
    status: 'arriving' | 'in_progress' | 'completed',
    body?: { lat?: number; lng?: number; confirmStop?: boolean },
  ) {
    return this.http
      .post<{ data: DriverRide }>(`${env.rideApi}/api/v1/rides/${id}/status`, { status, ...body })
      .pipe(map((r) => r.data));
  }

  connect(): void {
    this.watching = true;
    this.open();
  }

  private open(): void {
    if (!this.session.accessToken || this.socket?.connected) return;
    this.socket?.disconnect();
    this.socket = io('/trips', {
      path: '/ride-api/socket.io',
      auth: (cb) => cb({ token: this.session.accessToken }),
    });
    this.socket.on('ride:update', (ride: DriverRide) => this.zone.run(() => this.liveRide.set(ride)));
  }

  disconnect(): void {
    this.watching = false;
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
