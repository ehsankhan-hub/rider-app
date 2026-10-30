import { Namespace } from 'socket.io';

export class RideEvents {
  private nsp: Namespace | null = null;

  attach(nsp: Namespace): void {
    this.nsp = nsp;
  }

  emitRideUpdate(userId: string, ride: unknown): void {
    this.nsp?.to(`user:${userId}`).emit('ride:update', ride);
  }

  emitDriverLocation(customerUserId: string, point: { rideId: string; lat: number; lng: number }): void {
    this.nsp?.to(`user:${customerUserId}`).emit('driver:location', point);
  }
}
