import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService, CityRecord, CountryRecord, CurrencyRecord, StateRecord, VehicleRecord } from '../core/admin-api.service';
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
          <h2>Service city</h2>
          <p class="hint">Maps and new trips use this city. Saving a country name does not move it. Choose the country, then the default city.</p>
          @if (defaultCity(); as current) {
            <p class="ok">Current: {{ current.name }}, {{ current.stateName }}, {{ current.countryName }}</p>
          }
          <div class="grid">
            <label>Country
              <select [ngModel]="serviceCountryId" (ngModelChange)="pickServiceCountry($event)">
                @for (country of countries(); track country.id) {
                  <option [value]="country.id">{{ country.name }}</option>
                }
              </select>
            </label>
            <label>Default city
              <select [(ngModel)]="serviceCityId">
                @for (city of citiesInCountry(serviceCountryId); track city.id) {
                  <option [value]="city.id">{{ city.name }} · {{ city.stateName }}</option>
                }
              </select>
            </label>
          </div>
          @if (citiesInCountry(serviceCountryId).length === 0) {
            <p class="hint">This country has no city yet. Add one below, then choose it here.</p>
          }
          <button type="button" (click)="saveServiceCity()" [disabled]="busy() || !serviceCityId">Save default city</button>

          <h2>Cities</h2>
          <p class="hint">A city's timezone is the clock used for busy and peak fares.</p>
          @for (city of cities(); track city.id) {
            <div class="block">
              <strong>{{ city.countryName }} · {{ city.stateName }}</strong>
              <div class="grid">
                <label>City <input [(ngModel)]="city.name" /></label>
                <label>Timezone <input [(ngModel)]="city.timezone" /></label>
                <label>Latitude <input [(ngModel)]="city.lat" /></label>
                <label>Longitude <input [(ngModel)]="city.lng" /></label>
              </div>
              <label class="check"><input type="checkbox" [(ngModel)]="city.isActive" /> Active</label>
              <div class="row">
                <button type="button" (click)="saveCity(city)" [disabled]="busy()">Save</button>
                @if (city.isDefault) {
                  <span class="ok">Default service city</span>
                } @else {
                  <button class="ghost" type="button" (click)="makeDefaultCity(city)" [disabled]="busy()">Use this city</button>
                }
              </div>
            </div>
          }
          <h3>Add a city</h3>
          <div class="grid">
            <label>State
              <select [(ngModel)]="newCity.stateId">
                @for (state of states(); track state.id) {
                  <option [value]="state.id">{{ state.countryName }} · {{ state.name }}</option>
                }
              </select>
            </label>
            <label>Name <input [(ngModel)]="newCity.name" /></label>
            <label>Timezone <input [(ngModel)]="newCity.timezone" placeholder="Asia/Kolkata" /></label>
            <label>Latitude <input [(ngModel)]="newCity.lat" /></label>
            <label>Longitude <input [(ngModel)]="newCity.lng" /></label>
          </div>
          <button type="button" (click)="addCity()" [disabled]="busy()">Add city</button>

          <h2>States</h2>
          @for (state of states(); track state.id) {
            <div class="grid tight">
              <label>Name <input [(ngModel)]="state.name" /></label>
              <label class="check"><input type="checkbox" [(ngModel)]="state.isActive" /> Active</label>
              <button type="button" (click)="saveState(state)" [disabled]="busy()">Save</button>
            </div>
          }
          <div class="grid">
            <label>Country
              <select [(ngModel)]="newState.countryId">
                @for (country of countries(); track country.id) {
                  <option [value]="country.id">{{ country.name }}</option>
                }
              </select>
            </label>
            <label>New state <input [(ngModel)]="newState.name" /></label>
          </div>
          <button type="button" (click)="addState()" [disabled]="busy()">Add state</button>

          <h2>Countries</h2>
          @for (country of countries(); track country.id) {
            <div class="grid tight">
              <label>Name <input [(ngModel)]="country.name" /></label>
              <label>ISO <input [(ngModel)]="country.isoCode" maxlength="2" /></label>
              <label class="check"><input type="checkbox" [(ngModel)]="country.isActive" /> Active</label>
              <button type="button" (click)="saveCountry(country)" [disabled]="busy()">Save</button>
            </div>
          }
          <div class="grid">
            <label>New country <input [(ngModel)]="newCountry.name" /></label>
            <label>ISO <input [(ngModel)]="newCountry.isoCode" maxlength="2" /></label>
          </div>
          <button type="button" (click)="addCountry()" [disabled]="busy()">Add country</button>
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

  serviceCountryId = '';
  serviceCityId = '';

  newCountry = { name: '', isoCode: '' };
  newState = { countryId: '', name: '' };
  newCity = { stateId: '', name: '', timezone: 'Asia/Kolkata', lat: '25.4358', lng: '81.8463' };
  newCurrency = { code: '', symbol: '', name: '' };

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
    this.run(this.api.updateState(state.id, { name: state.name.trim(), isActive: state.isActive }), 'State saved');
  }

  addState(): void {
    this.run(this.api.createState({ countryId: this.newState.countryId, name: this.newState.name.trim() }), 'State added');
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
    this.run(this.api.updateCity(city.id, { isDefault: true, isActive: true }), `${city.name} is now the service city`);
  }

  defaultCity(): CityRow | undefined {
    return this.cities().find((city) => city.isDefault);
  }

  citiesInCountry(countryId: string): CityRow[] {
    return this.cities().filter((city) => city.countryId === countryId);
  }

  pickServiceCountry(countryId: string): void {
    this.serviceCountryId = countryId;
    const inCountry = this.citiesInCountry(countryId);
    if (!inCountry.some((city) => city.id === this.serviceCityId)) {
      this.serviceCityId = inCountry.find((city) => city.isDefault)?.id ?? inCountry[0]?.id ?? '';
    }
  }

  saveServiceCity(): void {
    const city = this.cities().find((item) => item.id === this.serviceCityId);
    if (!city) {
      this.error.set('Choose a default city');
      return;
    }
    this.makeDefaultCity(city);
  }

  addCity(): void {
    this.run(
      this.api.createCity({
        stateId: this.newCity.stateId,
        name: this.newCity.name.trim(),
        lat: Number(this.newCity.lat),
        lng: Number(this.newCity.lng),
        timezone: this.newCity.timezone.trim(),
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
        const current = cities.find((city) => city.isDefault) ?? cities[0];
        if (current) {
          this.serviceCountryId = current.countryId;
          this.serviceCityId = current.id;
        } else if (!this.serviceCountryId && countries[0]) {
          this.serviceCountryId = countries[0].id;
        }
        if (!this.newState.countryId && countries[0]) this.newState.countryId = countries[0].id;
        if (!this.newCity.stateId && states[0]) this.newCity.stateId = states[0].id;
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
        this.newState = { ...this.newState, name: '' };
        this.newCity = { ...this.newCity, name: '' };
        this.newCurrency = { code: '', symbol: '', name: '' };
        this.load();
      },
      error: (err) => {
        this.error.set(err.error?.error?.message ?? 'Could not save');
        this.busy.set(false);
      },
    });
  }
}
