/** Rough country boxes. A point inside one is that country, even far from the saved cities. */
const AREAS = {
  SA: { minLat: 16, maxLat: 32.5, minLng: 34.4, maxLng: 55.7, timezone: 'Asia/Riyadh' },
  IN: { minLat: 6.5, maxLat: 35.7, minLng: 68, maxLng: 97.5, timezone: 'Asia/Kolkata' },
} as const;

export type ServiceIso = keyof typeof AREAS;

export function countryIsoAt(lat: number, lng: number): ServiceIso | null {
  for (const [iso, box] of Object.entries(AREAS) as [ServiceIso, (typeof AREAS)[ServiceIso]][]) {
    if (lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng) return iso;
  }
  return null;
}

export function timezoneForCountry(iso: ServiceIso | null, fallback: string): string {
  if (!iso) return fallback;
  return AREAS[iso].timezone;
}
