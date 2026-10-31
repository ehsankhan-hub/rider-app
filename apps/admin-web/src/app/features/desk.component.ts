import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService, CityRecord, CountryRecord, CurrencyRecord, PlaceHit, StateRecord, VehicleRecord } from '../core/admin-api.service';
import { SessionService } from '../core/session.service';
import { LiveComponent } from './live.component';

interface CityRow extends CityRecord {
  stateName: string;
  countryName: string;
  countryId: string;
}

interface StateRow extends StateRecord {
  countryName: string;
}

function timezoneForPoint(lat: number, lng: number, fallback: string): string {
  if (lat >= 16 && lat <= 32.5 && lng >= 34.4 && lng <= 55.7) return 'Asia/Riyadh';
  if (lat >= 6.5 && lat <= 35.7 && lng >= 68 && lng <= 97.5) return 'Asia/Kolkata';
  return fallback;
}

@Component({
  selector: 'app-desk',
  standalone: true,
  imports: [FormsModule, LiveComponent],
  template: `
    <main>
      <header class="row">
        <div>
          <h1>Operations</h1>
          <p>Changes here apply to new trips, quotes, and maps. No app rebuild.</p>
        </div>
        <button class="ghost" type="button" (click)="logout()">Sign out</button>
      </header>
      <nav class="tabs">
        <button type="button" [class.ghost]="section() !== 'live'" (click)="section.set('live')">Live</button>
        <button type="button" [class.ghost]="section() !== 'area'" (click)="section.set('area')">Places</button>
        <button type="button" [class.ghost]="section() !== 'money'" (click)="section.set('money')">Currency</button>
        <button type="button" [class.ghost]="section() !== 'fares'" (click)="section.set('fares')">Fares</button>
      </nav>
      @if (error()) { <p class="err">{{ error() }}</p> }
      @if (notice()) { <p class="ok">{{ notice() }}</p> }

      @if (section() === 'live') {
        <app-live />
      }

      @if (section() === 'area') {
        <section class="card stack">
          <h2>Places</h2>
          <p class="hint">Each country is its own block. Rides run anywhere in a country that is turned on. The map city is only the opening point when a phone has no GPS.</p>
          @if (defaultCity(); as current) {
            <p class="ok">Map city: {{ current.name }}, {{ current.countryName }}</p>
          }

          @for (country of orderedCountries(); track country.id) {
            <article class="country" [class.off]="!country.isActive">
              <div class="country-head">
                <h2>{{ country.name }}</h2>
                <span class="badge">{{ country.isoCode }}</span>
                @if (!country.isActive) { <span class="stopped">Rides stopped</span> }
              </div>
              <div class="grid tight">
                <label>Name <input [(ngModel)]="country.name" /></label>
                <label>ISO <input [(ngModel)]="country.isoCode" maxlength="2" /></label>
                <label class="check"><input type="checkbox" [(ngModel)]="country.isActive" /> Country is on</label>
                <button type="button" (click)="saveCountry(country)" [disabled]="busy()">Save country</button>
              </div>

              @for (state of statesInCountry(country.id); track state.id) {
                <section class="state">
                  <div class="grid tight">
                    <label>Region <input [(ngModel)]="state.name" /></label>
                    <label class="check"><input type="checkbox" [(ngModel)]="state.isActive" /> Region is on</label>
                    <button type="button" (click)="saveState(state)" [disabled]="busy()">Save region</button>
                  </div>
                  @for (city of citiesInState(state.id); track city.id) {
                    <div class="city" [class.current]="city.isDefault">
                      <div class="row">
                        <strong>{{ city.name }}</strong>
                        @if (city.isDefault) { <span class="ok">Map city</span> }
                      </div>
                      <div class="grid">
                        <label class="suggest-wrap">City
                          <input [ngModel]="city.name" (ngModelChange)="onCityType(city.id, city, $event, country)" (blur)="hidePlaces()" autocomplete="off" />
                          @if (placeKey === city.id && placeHits().length) {
                            <ul class="suggest">
                              @for (hit of placeHits(); track hit.id) {
                                <li><button type="button" (mousedown)="choosePlace(city, hit)">{{ hit.label }}</button></li>
                              }
                            </ul>
                          }
                        </label>
                        <label>Timezone <input [(ngModel)]="city.timezone" /></label>
                        <label>Latitude <input [(ngModel)]="city.lat" /></label>
                        <label>Longitude <input [(ngModel)]="city.lng" /></label>
                      </div>
                      <div class="row">
                        <label class="check"><input type="checkbox" [(ngModel)]="city.isActive" /> City is on</label>
                        <button type="button" (click)="saveCity(city)" [disabled]="busy()">Save city</button>
                        @if (!city.isDefault) {
                          <button class="ghost" type="button" (click)="makeDefaultCity(city)" [disabled]="busy()">Use as map city</button>
                        }
                      </div>
                    </div>
                  }
                </section>
              }

              <div class="grid">
                <label class="suggest-wrap">New city
                  <input [ngModel]="countryCityDraft(country).name" (ngModelChange)="onCityType(country.id, countryCityDraft(country), $event, country)" (blur)="hidePlaces()" placeholder="Type a city" autocomplete="off" />
                  @if (placeKey === country.id && placeHits().length) {
                    <ul class="suggest">
                      @for (hit of placeHits(); track hit.id) {
                        <li><button type="button" (mousedown)="choosePlace(countryCityDraft(country), hit)">{{ hit.label }}</button></li>
                      }
                    </ul>
                  }
                </label>
                <label>Region <input [(ngModel)]="countryCityDraft(country).region" /></label>
                <label>Timezone <input [(ngModel)]="countryCityDraft(country).timezone" /></label>
                <label>Latitude <input [(ngModel)]="countryCityDraft(country).lat" /></label>
                <label>Longitude <input [(ngModel)]="countryCityDraft(country).lng" /></label>
                <button type="button" (click)="addCity(country)" [disabled]="busy()">Add city</button>
              </div>

              <div class="grid">
                <label>New region <input [(ngModel)]="regionDraft(country).name" placeholder="Region name" /></label>
                <button type="button" (click)="addState(country)" [disabled]="busy()">Add region</button>
              </div>
            </article>
          }

          <h2>Add a country</h2>
          <div class="grid">
            <label>Name <input [(ngModel)]="newCountry.name" /></label>
            <label>ISO <input [(ngModel)]="newCountry.isoCode" maxlength="2" /></label>
            <button type="button" (click)="addCountry()" [disabled]="busy()">Add country</button>
          </div>
        </section>
      }

      @if (section() === 'money') {
        <section class="card stack">
          <h2>Weekend days</h2>
          <p class="hint">Short English names, separated by commas. Prayagraj uses Sat,Sun. These days use the weekend fare.</p>
          <label>Days <input [(ngModel)]="weekendDays" placeholder="Sat,Sun" /></label>
          <div class="grid">
            <label>Assign a driver within (km) <input [(ngModel)]="assignRadiusKm" type="number" /></label>
            <label>Opening wallet amount <input [(ngModel)]="openingWalletAmount" type="number" /></label>
          </div>
          <button type="button" (click)="saveSettings()" [disabled]="busy()">Save settings</button>
        </section>
        <section class="card stack">
          <h2>Currency</h2>
          <p class="hint">The default currency is used on new quotes and on wallets created after the change.</p>
          @for (currency of currencies(); track currency.id) {
            <div class="grid tight">
              <label>Code <input [ngModel]="currency.code" disabled /></label>
              <label>Symbol <input [(ngModel)]="currency.symbol" /></label>
              <label>Name <input [(ngModel)]="currency.name" /></label>
              <label class="check"><input type="checkbox" [(ngModel)]="currency.isActive" /> Active</label>
              <button type="button" (click)="saveCurrency(currency)" [disabled]="busy()">Save</button>
              @if (currency.isDefault) {
                <span class="ok">Default</span>
              } @else {
                <button class="ghost" type="button" (click)="makeDefaultCurrency(currency)" [disabled]="busy()">Use this currency</button>
              }
            </div>
          }
          <div class="grid">
            <label>Code <input [(ngModel)]="newCurrency.code" maxlength="3" /></label>
            <label>Symbol <input [(ngModel)]="newCurrency.symbol" /></label>
            <label>Name <input [(ngModel)]="newCurrency.name" /></label>
          </div>
          <button type="button" (click)="addCurrency()" [disabled]="busy()">Add currency</button>
        </section>
      }

      @if (section() === 'fares') {
        <section class="card stack">
          <h2>Vehicle fares</h2>
          <p class="hint">Upfront fare is base + kilometres × per km + minutes × per minute. Busy hours make the minutes longer. They do not add a percent on top of the kilometres.</p>
          @for (vehicle of vehicles(); track vehicle.id) {
            <div class="block">
              <strong>{{ vehicle.code }}</strong>
              <div class="grid">
                <label>Name <input [(ngModel)]="vehicle.displayName" /></label>
                <label>Base <input [(ngModel)]="vehicle.baseFare" /></label>
                <label>Per km <input [(ngModel)]="vehicle.perKm" /></label>
                <label>Per minute <input [(ngModel)]="vehicle.perMinute" /></label>
                <label>Seats <input [(ngModel)]="vehicle.capacity" type="number" /></label>
              </div>
              <label class="check"><input type="checkbox" [(ngModel)]="vehicle.isActive" /> Active</label>
              <button type="button" (click)="saveVehicle(vehicle)" [disabled]="busy()">Save</button>
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      main { max-width: 980px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 16px; }
      h1, h2, h3, p { margin: 0; }
      .hint { color: var(--muted); }
      .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
      .tabs { display: flex; gap: 8px; }
      .stack { display: grid; gap: 14px; }
      .block { display: grid; gap: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: end; }
      .tight { align-items: end; }
      .check { display: flex; align-items: center; gap: 8px; color: var(--text); }
      .check input { width: auto; }
      .country { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: #12181f; }
      .country.off { opacity: 0.72; }
      .country-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .badge { color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; font-size: 12px; }
      .stopped { color: #fff; background: var(--danger); border-radius: 999px; padding: 2px 8px; font-size: 12px; }
      .state { display: grid; gap: 10px; margin-left: 8px; padding-left: 12px; border-left: 2px solid var(--line); }
      .city { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; }
      .city.current { border-color: var(--accent); }
      .suggest-wrap { position: relative; }
      .suggest { position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% - 4px); list-style: none; margin: 0; padding: 4px; background: #12181f; border: 1px solid var(--line); border-radius: 10px; }
      .suggest button { width: 100%; text-align: start; background: transparent; color: var(--text); font-weight: 500; }
    `,
  ],
})
export class DeskComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  section = signal<'live' | 'area' | 'money' | 'fares'>('live');
  busy = signal(false);
  error = signal('');
  notice = signal('');
  countries = signal<CountryRecord[]>([]);
  states = signal<StateRow[]>([]);
  cities = signal<CityRow[]>([]);
  currencies = signal<CurrencyRecord[]>([]);
  vehicles = signal<VehicleRecord[]>([]);
  assignRadiusKm = 25;
  openingWalletAmount = 25;
  weekendDays = 'Fri,Sat';

  newCountry = { name: '', isoCode: '' };
  private readonly regionDrafts = new Map<string, { name: string }>();
  private readonly cityDrafts = new Map<string, { name: string; region: string; timezone: string; lat: string; lng: string }>();
  newCurrency = { code: '', symbol: '', name: '' };
  placeHits = signal<PlaceHit[]>([]);
  placeKey = '';
  private placeTimer = 0;

  ngOnInit(): void {
    this.load();
  }

  logout(): void {
    this.session.clear();
    void this.router.navigateByUrl('/login');
  }

  saveCountry(country: CountryRecord): void {
    this.run(
      this.api.updateCountry(country.id, {
        name: country.name.trim(),
        isoCode: country.isoCode.trim(),
        isActive: country.isActive,
      }),
      'Country saved',
    );
  }

  addCountry(): void {
    this.run(this.api.createCountry({ name: this.newCountry.name.trim(), isoCode: this.newCountry.isoCode.trim() }), 'Country added');
  }

  saveState(state: StateRow): void {
    this.run(this.api.updateState(state.id, { name: state.name.trim(), isActive: state.isActive }), 'Region saved');
  }

  addState(country: CountryRecord): void {
    const name = this.regionDraft(country).name.trim();
    this.run(this.api.createState({ countryId: country.id, name }), 'Region added');
  }

  saveCity(city: CityRow): void {
    this.run(
      this.api.updateCity(city.id, {
        name: city.name.trim(),
        lat: Number(city.lat),
        lng: Number(city.lng),
        timezone: city.timezone.trim(),
        isActive: city.isActive,
      }),
      'City saved',
    );
  }

  makeDefaultCity(city: CityRow): void {
    this.run(this.api.updateCity(city.id, { isDefault: true, isActive: true }), `${city.name} is now the map city`);
  }

  defaultCity(): CityRow | undefined {
    return this.cities().find((city) => city.isDefault);
  }

  orderedCountries(): CountryRecord[] {
    return [...this.countries()].sort((a, b) => a.name.localeCompare(b.name));
  }

  statesInCountry(countryId: string): StateRow[] {
    return this.states()
      .filter((state) => state.countryId === countryId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  citiesInState(stateId: string): CityRow[] {
    return this.cities()
      .filter((city) => city.stateId === stateId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  regionDraft(country: CountryRecord): { name: string } {
    const existing = this.regionDrafts.get(country.id);
    if (existing) return existing;
    const created = { name: '' };
    this.regionDrafts.set(country.id, created);
    return created;
  }

  countryCityDraft(country: CountryRecord): { name: string; region: string; timezone: string; lat: string; lng: string } {
    const existing = this.cityDrafts.get(country.id);
    if (existing) return existing;
    const india = country.name === 'India' || country.isoCode.toUpperCase() === 'IN';
    const created = {
      name: '',
      region: '',
      timezone: india ? 'Asia/Kolkata' : 'Asia/Riyadh',
      lat: '',
      lng: '',
    };
    this.cityDrafts.set(country.id, created);
    return created;
  }

  onCityType(
    key: string,
    target: { name: string; lat: string; lng: string; timezone: string; region?: string },
    value: string,
    country: CountryRecord,
  ): void {
    target.name = value;
    this.placeKey = key;
    window.clearTimeout(this.placeTimer);
    const typed = value.trim();
    if (typed.length < 2) {
      this.placeHits.set([]);
      return;
    }
    target.lat = '';
    target.lng = '';
    if (target.region !== undefined) target.region = '';
    this.placeTimer = window.setTimeout(() => {
      const query = country.name ? `${typed}, ${country.name}` : typed;
      this.api.searchPlaces(query).subscribe({
        next: (hits) => {
          if (this.placeKey !== key) return;
          const list = hits.slice(0, 5);
          this.placeHits.set(list);
          const wanted = typed.toLowerCase();
          const match =
            list.find((hit) => this.shortName(hit).toLowerCase() === wanted) ??
            list.find((hit) => this.shortName(hit).toLowerCase().startsWith(wanted)) ??
            list.find((hit) => hit.label.toLowerCase().includes(wanted));
          if (match) this.fillPoint(target, match);
        },
        error: () => {
          if (this.placeKey === key) this.placeHits.set([]);
        },
      });
    }, 300);
  }

  choosePlace(target: { name: string; lat: string; lng: string; timezone: string; region?: string }, hit: PlaceHit): void {
    target.name = this.shortName(hit);
    this.fillPoint(target, hit);
    this.placeHits.set([]);
    this.placeKey = '';
  }

  hidePlaces(): void {
    window.setTimeout(() => {
      this.placeHits.set([]);
      this.placeKey = '';
    }, 200);
  }

  private fillPoint(target: { lat: string; lng: string; timezone: string; region?: string }, hit: PlaceHit): void {
    target.lat = hit.lat.toFixed(7);
    target.lng = hit.lng.toFixed(7);
    target.timezone = timezoneForPoint(hit.lat, hit.lng, target.timezone);
    if (target.region !== undefined && hit.region) target.region = hit.region;
  }

  private shortName(hit: PlaceHit): string {
    return hit.label.split(',')[0]?.trim() || hit.label;
  }

  addCity(country: CountryRecord): void {
    const draft = this.countryCityDraft(country);
    const regionName = draft.region.trim();
    if (!draft.name.trim() || !regionName || !draft.lat || !draft.lng) {
      this.error.set('Type a city and wait until the region and map point fill in');
      return;
    }
    const existing = this.statesInCountry(country.id).find((state) => state.name.toLowerCase() === regionName.toLowerCase());
    if (existing) {
      this.createCityIn(existing.id, draft);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.createState({ countryId: country.id, name: regionName }).subscribe({
      next: () => {
        this.api.catalog().subscribe({
          next: (catalog) => {
            const created = (catalog.countries ?? [])
              .flatMap((item) => item.states ?? [])
              .find((state) => state.countryId === country.id && state.name.toLowerCase() === regionName.toLowerCase());
            if (!created) {
              this.error.set('The region was added, but the city was not');
              this.busy.set(false);
              this.load();
              return;
            }
            this.createCityIn(created.id, draft);
          },
          error: () => {
            this.error.set('Could not add the city');
            this.busy.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Could not add the region');
        this.busy.set(false);
      },
    });
  }

  private createCityIn(stateId: string, draft: { name: string; timezone: string; lat: string; lng: string }): void {
    this.run(
      this.api.createCity({
        stateId,
        name: draft.name.trim(),
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        timezone: draft.timezone.trim(),
        isDefault: false,
      }),
      'City added',
    );
  }

  saveCurrency(currency: CurrencyRecord): void {
    this.run(
      this.api.updateCurrency(currency.id, {
        symbol: currency.symbol.trim(),
        name: currency.name.trim(),
        isActive: currency.isActive,
      }),
      'Currency saved',
    );
  }

  makeDefaultCurrency(currency: CurrencyRecord): void {
    this.run(this.api.updateCurrency(currency.id, { isDefault: true, isActive: true }), `${currency.code} is now the currency`);
  }

  addCurrency(): void {
    this.run(
      this.api.createCurrency({
        code: this.newCurrency.code.trim(),
        symbol: this.newCurrency.symbol.trim(),
        name: this.newCurrency.name.trim(),
        isDefault: false,
      }),
      'Currency added',
    );
  }

  saveSettings(): void {
    this.run(
      this.api.updateSettings({
        assignRadiusKm: Number(this.assignRadiusKm),
        openingWalletAmount: Number(this.openingWalletAmount),
        weekendDays: this.weekendDays.trim(),
      }),
      'Settings saved',
    );
  }

  saveVehicle(vehicle: VehicleRecord): void {
    this.run(
      this.api.updateVehicle(vehicle.id, {
        displayName: vehicle.displayName.trim(),
        baseFare: Number(vehicle.baseFare),
        perKm: Number(vehicle.perKm),
        perMinute: Number(vehicle.perMinute),
        capacity: Number(vehicle.capacity),
        isActive: vehicle.isActive,
      }),
      'Fare saved',
    );
  }

  private load(): void {
    this.api.catalog().subscribe({
      next: (catalog) => {
        const countries = catalog.countries ?? [];
        const states: StateRow[] = [];
        const cities: CityRow[] = [];
        for (const country of countries) {
          for (const state of country.states ?? []) {
            states.push({ ...state, countryName: country.name });
            for (const city of state.cities ?? []) {
              cities.push({ ...city, stateName: state.name, countryName: country.name, countryId: country.id });
            }
          }
        }
        this.countries.set(countries);
        this.states.set(states);
        this.cities.set(cities);
        this.currencies.set(catalog.currencies ?? []);
        this.vehicles.set(catalog.vehicles ?? []);
        this.assignRadiusKm = catalog.settings.assignRadiusKm;
        this.openingWalletAmount = catalog.settings.openingWalletAmount;
        this.weekendDays = catalog.settings.weekendDays;
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(err.error?.error?.message ?? 'Could not load settings');
      },
    });
  }

  private run(request: { subscribe: (handlers: { next: () => void; error: (err: { error?: { error?: { message?: string } } }) => void }) => void }, notice: string): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request.subscribe({
      next: () => {
        this.notice.set(notice);
        this.busy.set(false);
        this.newCountry = { name: '', isoCode: '' };
        this.newCurrency = { code: '', symbol: '', name: '' };
        for (const draft of this.regionDrafts.values()) draft.name = '';
        for (const draft of this.cityDrafts.values()) {
          draft.name = '';
          draft.region = '';
          draft.lat = '';
          draft.lng = '';
        }
        this.load();
      },
      error: (err) => {
        this.error.set(err.error?.error?.message ?? 'Could not save');
        this.busy.set(false);
      },
    });
  }
}
