import { logger } from '../config/logger';
import { haversineKm } from './geo';

export interface PlaceHit {
  id: string;
  label: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  region?: string;
  country?: string;
  countryCode?: string;
}

interface RankedHit extends PlaceHit {
  name: string;
  kind: string;
}

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
  error?: string;
}

interface EsriCandidate {
  address?: string;
  location?: { x?: number; y?: number };
  attributes?: Record<string, string>;
}

interface EsriSearchResponse {
  candidates?: EsriCandidate[];
}

interface EsriReverseResponse {
  address?: Record<string, string>;
  location?: { x?: number; y?: number };
  error?: { message?: string };
}

export interface PlaceSearchInput {
  q: string;
  lat?: number;
  lng?: number;
  lang: 'en' | 'ar';
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const ESRI = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'RiderPlatform/1.0 (local ride demo)',
};

export class PlacesService {
  async search(input: PlaceSearchInput): Promise<PlaceHit[]> {
    let hits = await this.searchNominatim(input);
    if (!hits?.length) hits = await this.searchEsri(input);
    return this.rankHits(hits ?? [], input.q, input.lat, input.lng);
  }

  async reverse(lat: number, lng: number, lang: 'en' | 'ar'): Promise<PlaceHit | null> {
    return (await this.reverseNominatim(lat, lng, lang)) ?? (await this.reverseEsri(lat, lng, lang));
  }

  private async searchNominatim(input: PlaceSearchInput): Promise<RankedHit[] | null> {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set('q', input.q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '12');
    url.searchParams.set('accept-language', input.lang);
    if (input.lat !== undefined && input.lng !== undefined) {
      const pad = 0.45;
      url.searchParams.set('viewbox', `${input.lng - pad},${input.lat + pad},${input.lng + pad},${input.lat - pad}`);
    }
    const body = await this.fetchJson<NominatimPlace[]>(url);
    if (!body) return null;
    return body.map((place, index) => this.fromNominatim(place, index)).filter((hit): hit is RankedHit => hit !== null);
  }

  private async reverseNominatim(lat: number, lng: number, lang: 'en' | 'ar'): Promise<PlaceHit | null> {
    const url = new URL(`${NOMINATIM}/reverse`);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', lang);
    const body = await this.fetchJson<NominatimPlace>(url);
    if (!body || body.error) return null;
    return this.fromNominatim(body, 0);
  }

  private async searchEsri(input: PlaceSearchInput): Promise<RankedHit[] | null> {
    const url = new URL(`${ESRI}/findAddressCandidates`);
    url.searchParams.set('f', 'json');
    url.searchParams.set('singleLine', input.q);
    url.searchParams.set('maxLocations', '8');
    url.searchParams.set('outFields', 'Addr_type,PlaceName,City,Region,Country,StAddr');
    url.searchParams.set('langCode', input.lang);
    if (input.lat !== undefined && input.lng !== undefined) {
      url.searchParams.set('location', `${input.lng},${input.lat}`);
    }
    const body = await this.fetchJson<EsriSearchResponse>(url);
    if (!body?.candidates) return null;
    return body.candidates
      .map((candidate, index) => this.fromEsriCandidate(candidate, index))
      .filter((hit): hit is RankedHit => hit !== null);
  }

  private async reverseEsri(lat: number, lng: number, lang: 'en' | 'ar'): Promise<PlaceHit | null> {
    const url = new URL(`${ESRI}/reverseGeocode`);
    url.searchParams.set('f', 'json');
    url.searchParams.set('location', `${lng},${lat}`);
    url.searchParams.set('langCode', lang);
    const body = await this.fetchJson<EsriReverseResponse>(url);
    const address = body?.address;
    const y = body?.location?.y ?? lat;
    const x = body?.location?.x ?? lng;
    if (!address || body?.error) return null;
    const label = address['LongLabel'] || address['Address'] || `${y.toFixed(5)}, ${x.toFixed(5)}`;
    return { id: `esri-${y.toFixed(5)}-${x.toFixed(5)}`, label, lat: y, lng: x };
  }

  private fromNominatim(place: NominatimPlace, index: number): RankedHit | null {
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const address = place.address ?? {};
    const name = place.name || address['road'] || address['city'] || address['town'] || place.display_name?.split(',')[0] || '';
    const area = address['suburb'] || address['neighbourhood'] || address['city_district'];
    const city = address['city'] || address['town'] || address['village'];
    const parts = [name, area, city, address['state']].filter((part): part is string => Boolean(part));
    const label = [...new Set(parts)].slice(0, 3).join(', ') || place.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const id = place.osm_id ? `${place.osm_type ?? 'osm'}-${place.osm_id}` : `${lat.toFixed(5)}-${lng.toFixed(5)}-${index}`;
    return {
      id,
      label,
      lat,
      lng,
      region: address['state'] || undefined,
      country: address['country'] || undefined,
      countryCode: address['country_code']?.toUpperCase() || undefined,
      name: name || label,
      kind: `${place.category ?? ''}=${place.type ?? ''}`,
    };
  }

  private fromEsriCandidate(candidate: EsriCandidate, index: number): RankedHit | null {
    const lat = candidate.location?.y;
    const lng = candidate.location?.x;
    if (lat === undefined || lng === undefined) return null;
    const attrs = candidate.attributes ?? {};
    const name = attrs['PlaceName'] || attrs['StAddr'] || candidate.address?.split(',')[0] || '';
    const parts = [name, attrs['City'], attrs['Region']].filter((part): part is string => Boolean(part));
    const label = [...new Set(parts)].slice(0, 3).join(', ') || candidate.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return {
      id: `esri-${index}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
      label,
      lat,
      lng,
      region: attrs['Region'] || undefined,
      country: attrs['Country'] || undefined,
      name: name || label,
      kind: this.esriKind(attrs['Addr_type'] ?? ''),
    };
  }

  private esriKind(addrType: string): string {
    const kind = addrType.toLowerCase();
    if (kind === 'locality' || kind === 'city') return 'place=city';
    if (kind === 'town') return 'place=town';
    if (kind.includes('admin') || kind === 'region' || kind === 'subregion') return 'boundary=administrative';
    if (kind.includes('street') || kind.includes('pointaddress') || kind === 'postal') return 'highway=residential';
    if (kind === 'poi') return 'amenity=yes';
    return 'place=other';
  }

  private async fetchJson<T>(url: URL): Promise<T | null> {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        logger.warn({ status: response.status, host: url.host }, 'Place search failed');
        return null;
      }
      return (await response.json()) as T;
    } catch (err) {
      logger.warn({ err, host: url.host }, 'Place search unavailable');
      return null;
    }
  }

  private rankHits(hits: RankedHit[], query: string, lat?: number, lng?: number): PlaceHit[] {
    const q = query.trim().toLowerCase();
    const ordered = [...hits].sort((a, b) => this.score(b, q, lat, lng) - this.score(a, q, lat, lng));
    const unique: PlaceHit[] = [];
    const seen = new Set<string>();
    for (const hit of ordered) {
      const key = `${hit.label.toLowerCase()}@${hit.lat.toFixed(2)},${hit.lng.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const distanceKm = lat !== undefined && lng !== undefined ? Number(haversineKm(lat, lng, hit.lat, hit.lng).toFixed(1)) : undefined;
      unique.push({
        id: hit.id,
        label: hit.label,
        lat: hit.lat,
        lng: hit.lng,
        distanceKm,
        region: hit.region,
        country: hit.country,
        countryCode: hit.countryCode,
      });
    }
    return unique.slice(0, 6);
  }

  private score(hit: RankedHit, query: string, lat?: number, lng?: number): number {
    const name = hit.name.toLowerCase();
    let score = 0;
    if (name === query) score += 1000;
    else if (name.startsWith(query)) score += 500;
    else if (name.includes(query)) score += 200;

    if (hit.kind === 'place=city') score += 900;
    else if (hit.kind === 'place=town') score += 600;
    else if (hit.kind === 'place=state' || hit.kind.startsWith('boundary=')) score += 250;
    else if (hit.kind.startsWith('place=')) score += 180;
    else if (hit.kind.startsWith('amenity=') || hit.kind.startsWith('tourism=') || hit.kind.startsWith('building=')) {
      score += 220;
    } else if (hit.kind.startsWith('railway=')) score += 40;
    else if (hit.kind.startsWith('highway=')) score += 20;

    if (lat !== undefined && lng !== undefined) {
      const km = haversineKm(lat, lng, hit.lat, hit.lng);
      score -= km <= 25 ? km : 400 + (km - 25) * 3;
    }
    return score;
  }
}
