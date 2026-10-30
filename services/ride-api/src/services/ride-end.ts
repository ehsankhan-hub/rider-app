import { haversineKm } from './geo';

const DROP_OFF_KM = 0.5;
const STILL_AT_PICKUP_KM = 0.3;
const MIN_TRIP_MS = 60_000;

export type EndNote = 'at_dropoff' | 'ended_early' | 'needs_review';

export function decideEnd(input: {
  here: { lat: number; lng: number } | null;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  startedAt: Date | null;
  now: Date;
}): EndNote {
  if (!input.here) return 'needs_review';
  const toDropoff = haversineKm(input.here.lat, input.here.lng, input.dropoff.lat, input.dropoff.lng);
  if (toDropoff <= DROP_OFF_KM) return 'at_dropoff';
  const toPickup = haversineKm(input.here.lat, input.here.lng, input.pickup.lat, input.pickup.lng);
  const elapsed = input.startedAt ? input.now.getTime() - input.startedAt.getTime() : Number.POSITIVE_INFINITY;
  if (toPickup <= STILL_AT_PICKUP_KM || elapsed < MIN_TRIP_MS) return 'needs_review';
  return 'ended_early';
}

export function confirmStopMessage(note: EndNote): string {
  if (note === 'needs_review') {
    return 'This stop is still at the pickup, or the trip just started. If the rider got out here, the fare is the minimum fare, not the price quoted for the drop-off.';
  }
  return 'You are not at the drop-off yet. If the rider asked to stop here, the fare is recalculated for the distance driven so far.';
}

/** The quoted fare applies only when the car reaches the drop-off. An earlier stop is priced on the distance and time actually driven, and never above the quote. */
export function settleFare(input: {
  upfront: number;
  base: number;
  perKm: number;
  perMinute: number;
  traveledKm: number;
  elapsedMin: number;
}): { fare: number; distanceKm: number; durationMin: number } {
  const distanceKm = Number(Math.max(0, input.traveledKm).toFixed(2));
  const durationMin = Math.max(1, Math.round(input.elapsedMin));
  if (distanceKm <= STILL_AT_PICKUP_KM) {
    return {
      fare: Number(Math.min(input.upfront, input.base).toFixed(2)),
      distanceKm: 0,
      durationMin,
    };
  }
  const raw = input.base + distanceKm * input.perKm + durationMin * input.perMinute;
  return {
    fare: Number(Math.min(input.upfront, Math.max(raw, input.base)).toFixed(2)),
    distanceKm,
    durationMin,
  };
}
