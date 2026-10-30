import { Injectable, NgZone, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Ride } from './ride-api.service';
import { SessionService } from './session.service';

export interface DriverPoint {
  rideId: string;
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class TripSocketService {
  private readonly zone = inject(NgZone);
  private readonly session = inject(SessionService);
  private socket?: Socket;
  private watching = false;

  readonly ride = signal<Ride | null>(null);
  readonly driverPoint = signal<DriverPoint | null>(null);

  constructor() {
    this.session.listen(() => {
      if (this.watching && this.session.accessToken && !this.socket?.connected) this.open();
    });
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
      transports: ['websocket', 'polling'],
    });
    this.socket.on('ride:update', (ride: Ride) => this.zone.run(() => this.ride.set(ride)));
    this.socket.on('driver:location', (point: DriverPoint) => this.zone.run(() => this.driverPoint.set(point)));
  }

  disconnect(): void {
    this.watching = false;
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
