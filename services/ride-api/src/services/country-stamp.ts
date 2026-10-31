import { RegionDao } from '../dao/region.dao';
import { countryIsoAt } from './service-area';
import { PlacesService } from './places.service';

export interface StampedCountry {
  iso: string;
  name: string;
}

/** The country of a map point. Known boxes stay local. Anywhere else uses the place lookup once. */
export class CountryStamp {
  constructor(
    private readonly regions: RegionDao,
    private readonly places: PlacesService,
  ) {}

  async at(lat: number, lng: number, allowLookup = true): Promise<StampedCountry | null> {
    const boxed = countryIsoAt(lat, lng);
    if (boxed) return this.named(boxed, null);
    if (!allowLookup) return null;
    const hit = await this.places.reverse(lat, lng, 'en');
    const iso = hit?.countryCode?.toUpperCase();
    if (!iso || iso.length !== 2) return null;
    return this.named(iso, hit?.country ?? null);
  }

  private async named(iso: string, fallback: string | null): Promise<StampedCountry> {
    const country = await this.regions.findCountryByIso(iso);
    return { iso, name: country?.name ?? fallback ?? iso };
  }
}
