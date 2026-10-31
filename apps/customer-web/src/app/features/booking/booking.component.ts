import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { FareQuote, NearbyCar, PlaceHit, Ride, RideApiService, VehicleType } from '../../core/ride-api.service';
import { SessionService } from '../../core/session.service';
import { TripSocketService } from '../../core/trip-socket.service';

type MapLang = 'en' | 'ar';
type PointField = 'pickup' | 'dropoff';

const COPY = {
  en: {
    title: 'Where to?',
    hint: 'Search a place, or tap the map.',
    pickup: 'From',
    dropoff: 'To',
    pickupPh: 'Search pickup',
    dropoffPh: 'Search dropoff',
    vehicle: 'Choose a ride',
    seats: 'seats',
    pay: 'Pay with',
    cash: 'Cash',
    wallet: 'Wallet',
    confirm: 'Confirm ride',
    confirmPickupTitle: 'Confirm pickup spot',
    dragPin: 'Drag the map to move the pin',
    confirmPickup: 'Confirm pickup',
    choose: 'Choose',
    back: 'Back',
    booking: 'Booking…',
    lang: 'Map language',
    locating: 'Finding your location…',
    currentLocation: 'Current location',
    needPickup: 'Choose a pickup from search or the map.',
    needLocation: 'Allow location so the pickup is where you are. Or search for it.',
    needDropoff: 'Pickup is set. Choose a dropoff.',
    needVehicle: 'Choose a vehicle type.',
    quoteFailed: 'Could not calculate the fare.',
    vehiclesFailed: 'Could not load vehicles. Sign in again.',
    noPlaces: 'No matching places',
    nearby: 'Cars nearby',
    min: 'min',
    trafficLight: 'Light traffic',
    trafficNormal: 'Normal traffic',
    trafficBusy: 'Busy traffic',
    trafficPeak: 'Peak traffic',
    standardRate: 'priced by distance and time',
    booked: 'Ride confirmed',
    searching: 'Looking for a driver',
    arriving: 'Driver is on the way',
    started: 'Trip started',
    completed: 'Trip completed',
    driver: 'Driver',
  },
  ar: {
    title: 'إلى أين؟',
    hint: 'ابحث عن مكان، أو اضغط على الخريطة.',
    pickup: 'من',
    dropoff: 'إلى',
    pickupPh: 'ابحث عن نقطة الانطلاق',
    dropoffPh: 'ابحث عن الوجهة',
    vehicle: 'اختر الرحلة',
    seats: 'مقاعد',
    pay: 'الدفع',
    cash: 'نقداً',
    wallet: 'المحفظة',
    confirm: 'تأكيد الرحلة',
    confirmPickupTitle: 'تأكيد نقطة الانطلاق',
    dragPin: 'اسحب الخريطة لتحريك الدبوس',
    confirmPickup: 'تأكيد الانطلاق',
    choose: 'اختر',
    back: 'رجوع',
    booking: 'جارٍ الحجز…',
    lang: 'لغة الخريطة',
    locating: 'جارٍ تحديد موقعك…',
    currentLocation: 'موقعك الحالي',
    needPickup: 'حدد الانطلاق بالبحث أو من الخريطة.',
    needLocation: 'اسمح بالموقع ليكون الانطلاق من مكانك. أو ابحث عنه.',
    needDropoff: 'تم تحديد الانطلاق. حدد الوجهة.',
    needVehicle: 'اختر نوع السيارة.',
    quoteFailed: 'تعذر حساب الأجرة.',
    vehiclesFailed: 'تعذر تحميل أنواع السيارات. سجّل الدخول مرة أخرى.',
    noPlaces: 'لا توجد نتائج',
    nearby: 'سيارات قريبة',
    min: 'د',
    trafficLight: 'حركة خفيفة',
    trafficNormal: 'حركة عادية',
    trafficBusy: 'ازدحام',
    trafficPeak: 'ذروة الازدحام',
    standardRate: 'السعر حسب المسافة والوقت',
    booked: 'تم تأكيد الرحلة',
    searching: 'جارٍ البحث عن سائق',
    arriving: 'السائق في الطريق',
    started: 'بدأت الرحلة',
    completed: 'اكتملت الرحلة',
    driver: 'السائق',
  },
} as const;

const CAR_COLOR: Record<NearbyCar['vehicleCode'], string> = {
  economy: '#3ddc97',
  comfort: '#6cb6ff',
  xl: '#f0c14b',
};

const CAR_IMAGES: Record<string, string> = {
  economy: 'assets/cars/economy.jpg',
  comfort: 'assets/cars/comfort.jpg',
  xl: 'assets/cars/xl.jpg',
};

const VEHICLE_ORDER: Record<string, number> = { economy: 0, comfort: 1, xl: 2 };

const BLURB: Record<string, { en: string; ar: string }> = {
  economy: { en: 'Affordable rides for every day', ar: 'رحلات يومية بسعر مناسب' },
  comfort: { en: 'Newer cars with extra legroom', ar: 'سيارات أحدث ومساحة أرجل أكبر' },
  xl: { en: 'Extra seats for a group', ar: 'مقاعد إضافية للمجموعة' },
};

type BookStage = 'search' | 'pickup' | 'rides';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="stage" [class.picking]="stage() === 'pickup'" [attr.dir]="lang() === 'ar' ? 'rtl' : 'ltr'">
      <div #mapHost class="map"></div>
      @if (stage() === 'pickup') {
        <div class="pin">
          <div class="pin-label">{{ pickupPinLabel() }}</div>
          <div class="pin-stem"></div>
          <div class="pin-dot"></div>
        </div>
      }
      <section class="sheet">
        @switch (stage()) {
          @case ('search') {
            <div class="sheet-head">
              <h2>{{ t('title') }}</h2>
              <label class="lang">
                <select [ngModel]="lang()" (ngModelChange)="setLanguage($event)">
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
            </div>
            <p class="hint">{{ stepHint() }}</p>
            <label class="field">
              <span class="mark from"></span>
              <input
                [value]="pickupQuery()"
                (input)="onQuery('pickup', $any($event.target).value)"
                (focus)="focusedField.set('pickup')"
                [placeholder]="locating() ? t('locating') : t('pickupPh')"
                autocomplete="off"
              />
            </label>
            @if (activeSearch() === 'pickup') {
              <ul class="suggest">
                @for (place of suggestions(); track place.id) {
                  <li>
                    <button type="button" (mousedown)="choosePlace('pickup', place)">{{ placeLabel(place) }}</button>
                  </li>
                } @empty {
                  @if (pickupQuery().trim().length >= 2 && !searching()) {
                    <li class="empty">{{ t('noPlaces') }}</li>
                  }
                }
              </ul>
            }
            <label class="field">
              <span class="mark to"></span>
              <input
                [value]="dropoffQuery()"
                (input)="onQuery('dropoff', $any($event.target).value)"
                (focus)="focusedField.set('dropoff')"
                [placeholder]="t('dropoffPh')"
                autocomplete="off"
              />
            </label>
            @if (activeSearch() === 'dropoff') {
              <ul class="suggest">
                @for (place of suggestions(); track place.id) {
                  <li>
                    <button type="button" (mousedown)="choosePlace('dropoff', place)">{{ placeLabel(place) }}</button>
                  </li>
                } @empty {
                  @if (dropoffQuery().trim().length >= 2 && !searching()) {
                    <li class="empty">{{ t('noPlaces') }}</li>
                  }
                }
              </ul>
            }
            @if (pickupPoint() && dropoffPoint()) {
              <button class="go" type="button" (click)="confirmPickup()">{{ t('vehicle') }}</button>
            }
          }
          @case ('pickup') {
            <div class="sheet-head">
              <button class="back" type="button" (click)="backToSearch()">{{ t('back') }}</button>
            </div>
            <h2>{{ t('confirmPickupTitle') }}</h2>
            <p class="hint">{{ t('dragPin') }}</p>
            <div class="addr">
              <div>
                <strong>{{ addressLine() }}</strong>
                @if (addressRest()) {
                  <span>{{ addressRest() }}</span>
                }
              </div>
              <button class="find" type="button" (click)="backToSearch()" [attr.aria-label]="t('pickupPh')">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M16 16l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <button class="go" type="button" (click)="confirmPickup()">{{ t('confirmPickup') }}</button>
          }
          @case ('rides') {
            @if (rideLocked()) {
              <h2>{{ t('booked') }}</h2>
              @if (message()) {
                <p class="status" [class.ok]="messageKind() === 'ok'" [class.err]="messageKind() === 'err'">{{ message() }}</p>
              }
            } @else {
              <div class="sheet-head">
                <button class="back" type="button" (click)="backToSearch()">{{ t('back') }}</button>
                <h2>{{ t('vehicle') }}</h2>
              </div>
              <div class="ride-list">
                @for (v of orderedVehicles(); track v.id) {
                  <button type="button" class="ride" [class.on]="vehicleTypeId === v.id" (click)="selectVehicle(v.id)">
                    <img [src]="carImage(v.code)" [alt]="v.displayName" />
                    <span class="meta">
                      <strong>
                        {{ v.displayName }}
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                          <circle cx="8" cy="5" r="2.2" fill="currentColor" />
                          <path d="M3.5 13c.6-2.2 2.3-3.2 4.5-3.2S12 10.8 12.5 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                        </svg>
                        {{ v.capacity }}
                      </strong>
                      <em>{{ arrivalText(v.code) }}</em>
                      <small>{{ blurb(v.code) }}</small>
                    </span>
                    <b>{{ priceText(v.id) }}</b>
                  </button>
                }
              </div>
              <div class="payline">
                <span class="pay-ico"></span>
                <select [(ngModel)]="paymentMethod">
                  <option value="CASH">{{ t('cash') }}</option>
                  <option value="WALLET">{{ t('wallet') }}</option>
                </select>
              </div>
              <button class="go" type="button" (click)="book()" [disabled]="busy()">
                {{ busy() ? t('booking') : t('choose') + ' ' + selectedName() }}
              </button>
            }
          }
        }
        @if (message() && messageKind() === 'err' && !rideLocked()) {
          <p class="status err">{{ message() }}</p>
        }
      </section>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; min-height: 0; }
      .stage { position: relative; height: 100%; min-height: 0; }
      .map { position: absolute; inset: 0; z-index: 1; }
      .pin {
        position: absolute;
        left: 50%;
        top: calc((100% - 260px) / 2);
        transform: translate(-50%, -100%);
        z-index: 450;
        pointer-events: none;
        display: grid;
        justify-items: center;
      }
      .pin-label {
        background: #111;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        padding: 6px 10px;
        border-radius: 8px;
        margin-bottom: 6px;
        max-width: 220px;
        text-align: center;
      }
      .pin-stem { width: 2px; height: 16px; background: #111; }
      .pin-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #111;
        border: 3px solid #fff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        margin-top: -2px;
      }
      .sheet {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2;
        background: var(--panel);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 18px 18px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.18);
        padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: calc(100% - 24px);
        overflow: auto;
      }
      .sheet-head { display: flex; align-items: center; gap: 10px; }
      .sheet-head h2 { flex: 1; text-align: center; }
      h2 { margin: 0; font-size: 20px; }
      .hint { margin: 0; color: var(--muted); font-size: 14px; }
      .lang { margin-inline-start: auto; min-width: 110px; }
      .lang select, .field input, .payline select {
        background: #12181f;
        color: var(--text);
        border: 0;
      }
      .field {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #12181f;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding-inline-start: 12px;
      }
      .field input { background: transparent; padding-inline-start: 0; }
      .mark { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
      .mark.from { background: var(--accent); }
      .mark.to { background: #6cb6ff; border-radius: 2px; }
      .suggest {
        list-style: none;
        margin: 0;
        padding: 4px;
        background: #12181f;
        border: 1px solid var(--line);
        border-radius: 12px;
        max-height: 180px;
        overflow: auto;
      }
      .suggest button {
        width: 100%;
        text-align: start;
        background: transparent;
        color: var(--text);
        font-weight: 500;
        padding: 10px;
      }
      .suggest button:hover { background: #1c2632; }
      .suggest .empty { padding: 10px; color: var(--muted); }
      .addr {
        display: flex;
        align-items: center;
        gap: 12px;
        border-top: 1px solid var(--line);
        padding-top: 12px;
      }
      .addr div { display: grid; gap: 2px; flex: 1; min-width: 0; }
      .addr strong { font-size: 16px; }
      .addr span { color: var(--muted); font-size: 13px; }
      .sheet button.back, .sheet button.find {
        width: auto;
        background: transparent;
        color: var(--text);
        padding: 6px;
        font-weight: 600;
      }
      .ride-list { display: grid; gap: 4px; }
      .payline, .sheet button.go { flex-shrink: 0; }
      .sheet button.ride {
        width: 100%;
        display: grid;
        grid-template-columns: 124px 1fr auto;
        align-items: center;
        gap: 8px;
        text-align: start;
        background: transparent;
        color: var(--text);
        border-radius: 14px;
        padding: 8px;
        font-weight: 500;
      }
      .sheet button.ride.on { background: #12181f; box-shadow: inset 0 0 0 2px var(--accent); }
      .sheet button.ride img {
        width: 124px;
        height: 72px;
        object-fit: contain;
        background: #1b1f27;
        border-radius: 10px;
      }
      .meta { display: grid; gap: 2px; min-width: 0; }
      .meta strong { display: flex; align-items: center; gap: 4px; font-size: 16px; }
      .meta em { font-style: normal; color: var(--muted); font-size: 13px; }
      .meta small { color: var(--muted); font-size: 13px; }
      .sheet button.ride b { font-size: 15px; white-space: nowrap; }
      .payline { display: flex; align-items: center; gap: 10px; }
      .pay-ico { width: 28px; height: 22px; border-radius: 4px; background: #128a3e; flex: 0 0 auto; }
      .payline select { width: auto; font-weight: 700; padding: 8px 28px 8px 8px; }
      .sheet button.go {
        width: 100%;
        background: var(--accent);
        color: #06281a;
        border-radius: 12px;
        padding: 14px 16px;
        font-size: 16px;
      }
      .status { margin: 0; padding: 10px 12px; border-radius: 10px; }
      .status.ok { color: #06281a; background: var(--accent); }
      .status.err { color: #fff; background: var(--danger); }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
      @media (min-width: 900px) {
        .sheet { left: 16px; right: auto; width: min(420px, calc(100% - 32px)); bottom: 16px; border-radius: 18px; }
        .stage.picking .pin { top: 50%; }
      }
    `,
  ],
})
export class BookingComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(RideApiService);
  private readonly zone = inject(NgZone);
  private readonly session = inject(SessionService);
  private readonly live = inject(TripSocketService);
  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private map?: L.Map;
  private baseLayer?: L.TileLayer;
  private pickupMarker?: L.CircleMarker;
  private dropoffMarker?: L.CircleMarker;
  private routeLine?: L.Polyline;
  private carMarkers: L.Marker[] = [];
  private driverMarker?: L.Marker;
  private activeRideId: string | null = null;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private carsTimer?: ReturnType<typeof setTimeout>;
  private searchSeq = 0;
  private quoteSeq = 0;
  private userDragging = false;
  private pickupRev = 0;
  private dropoffRev = 0;
  private lastPointAt = 0;

  vehicles = signal<VehicleType[]>([]);
  quotes = signal<Record<string, FareQuote>>({});
  quote = signal<FareQuote | null>(null);
  stage = signal<BookStage>('search');
  message = signal('');
  messageKind = signal<'ok' | 'err' | 'info'>('info');
  busy = signal(false);
  rideLocked = signal(false);
  lang = signal<MapLang>('en');
  pickupQuery = signal('');
  dropoffQuery = signal('');
  suggestions = signal<PlaceHit[]>([]);
  searching = signal(false);
  activeSearch = signal<PointField | null>(null);
  focusedField = signal<PointField | null>(null);
  locating = signal(false);
  private pickupFromUser = false;
  private locationDenied = signal(false);
  private serviceCity: { lat: number; lng: number } | null = null;
  nearbyCars = signal<NearbyCar[]>([]);

  vehicleTypeId = '';
  paymentMethod: 'CASH' | 'WALLET' = 'CASH';
  readonly pickupPoint = signal<L.LatLng | null>(null);
  readonly dropoffPoint = signal<L.LatLng | null>(null);

  constructor() {
    effect(() => {
      const ride = this.live.ride();
      if (!ride || ride.id !== this.activeRideId) return;
      const finished = ride.status === 'completed' || ride.status === 'cancelled';
      this.rideLocked.set(!finished);
      this.show(this.rideSummary(ride), ride.status === 'cancelled' ? 'err' : 'ok');
    });
    effect(() => {
      const point = this.live.driverPoint();
      if (!point || point.rideId !== this.activeRideId) return;
      this.moveDriver(point.lat, point.lng);
    });
  }

  ngAfterViewInit(): void {
    const center: L.LatLngExpression = [24.7136, 46.6753];
    const host = this.mapHost().nativeElement;
    this.map = L.map(host, { zoomControl: true }).setView(center, 13);
    this.map.createPane('points');
    const pointsPane = this.map.getPane('points');
    if (pointsPane) pointsPane.style.zIndex = '650';
    this.applyTiles(this.lang());
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => this.onMapClick(e.latlng));
    });
    this.map.on('dragstart', () => {
      this.zone.run(() => {
        this.userDragging = true;
      });
    });
    this.map.on('moveend', () => {
      this.zone.run(() => {
        if (!this.map) return;
        if (this.stage() === 'pickup') {
          if (!this.userDragging) return;
          this.userDragging = false;
          const at = this.latLngUnderPin();
          if (!at) return;
          this.pickupFromUser = true;
          this.pickupPoint.set(at);
          this.queueNearby(at.lat, at.lng);
          this.reverseInto('pickup', at);
          return;
        }
        this.userDragging = false;
        if (this.pickupPoint()) return;
        const mapCenter = this.map.getCenter();
        this.queueNearby(mapCenter.lat, mapCenter.lng);
      });
    });
    setTimeout(() => this.map?.invalidateSize(), 50);
    this.api.runtime().subscribe({
      next: (config) => {
        this.serviceCity = { lat: config.city.lat, lng: config.city.lng };
        if (!this.pickupFromUser) this.showServiceCity();
        this.useCurrentLocation();
      },
    });
    this.live.connect();
    this.api.listRides().subscribe({
      next: (rides) => {
        const open = rides.find((ride) => !['completed', 'cancelled'].includes(ride.status));
        if (!open) return;
        this.activeRideId = open.id;
        this.rideLocked.set(true);
        this.stage.set('rides');
        this.show(this.rideSummary(open), 'ok');
      },
    });

    this.api.vehicleTypes().subscribe({
      next: (list) => {
        this.vehicles.set(list);
        const economy = list.find((item) => item.code === 'economy');
        const initial = economy ?? list[0];
        if (!this.vehicleTypeId && initial) {
          this.vehicleTypeId = initial.id;
          this.refreshQuote();
        }
      },
      error: () => this.show(this.t('vehiclesFailed'), 'err'),
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.carsTimer);
    this.map?.remove();
  }

  t(key: keyof (typeof COPY)['en']): string {
    return COPY[this.lang()][key];
  }

  carColor(car: NearbyCar): string {
    return CAR_COLOR[car.vehicleCode];
  }

  orderedVehicles(): VehicleType[] {
    return [...this.vehicles()].sort((a, b) => (VEHICLE_ORDER[a.code] ?? 9) - (VEHICLE_ORDER[b.code] ?? 9));
  }

  carImage(code: string): string {
    return CAR_IMAGES[code] ?? CAR_IMAGES['economy'];
  }

  etaFor(code: string): number | null {
    const nearest = this.nearbyCars()
      .filter((car) => car.vehicleCode === code)
      .sort((a, b) => a.etaMin - b.etaMin)[0];
    return nearest ? nearest.etaMin : null;
  }

  selectVehicle(id: string): void {
    this.vehicleTypeId = id;
    const cached = this.quotes()[id];
    if (cached) {
      this.quote.set(cached);
      this.drawRoute(cached.route);
      return;
    }
    this.refreshQuote();
  }

  blurb(code: string): string {
    const text = BLURB[code] ?? BLURB['economy'];
    return text[this.lang()];
  }

  selectedName(): string {
    return this.vehicles().find((item) => item.id === this.vehicleTypeId)?.displayName ?? '';
  }

  addressLine(): string {
    const first = this.pickupQuery().split(',')[0]?.trim();
    return first || this.pickupQuery() || this.t('locating');
  }

  addressRest(): string {
    return this.pickupQuery().split(',').slice(1).map((part) => part.trim()).filter(Boolean).join(', ');
  }

  pickupPinLabel(): string {
    const street = this.addressLine();
    return this.lang() === 'ar' ? `الانطلاق من ${street}` : `Pickup on ${street}`;
  }

  priceText(id: string): string {
    const quoted = this.quotes()[id];
    if (!quoted) return '…';
    const amount = Number(quoted.fareAmount);
    const value = Number.isFinite(amount) ? amount.toFixed(2) : quoted.fareAmount;
    return `${quoted.currency} ${value}`;
  }

  arrivalText(code: string): string {
    const eta = this.etaFor(code);
    if (eta != null) {
      const at = new Date(Date.now() + eta * 60000);
      const clock = at.toLocaleTimeString(this.lang() === 'ar' ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' });
      return `${clock} · ${eta} ${this.t('min')}`;
    }
    const vehicle = this.vehicles().find((item) => item.code === code);
    const quoted = vehicle ? this.quotes()[vehicle.id] : undefined;
    return quoted ? `${quoted.durationMin} ${this.t('min')}` : '';
  }

  openPickup(): void {
    if (!this.pickupPoint()) {
      this.show(this.t('needPickup'), 'err');
      return;
    }
    if (!this.dropoffPoint()) {
      this.show(this.t('needDropoff'), 'err');
      return;
    }
    this.message.set('');
    this.activeSearch.set(null);
    this.userDragging = false;
    this.stage.set('pickup');
    this.routeLine?.remove();
    this.routeLine = undefined;
    this.syncPickupMarker();
    setTimeout(() => this.showPickupOnPin(), 40);
  }

  confirmPickup(): void {
    this.message.set('');
    this.stage.set('rides');
    this.syncPickupMarker();
    this.refreshQuote();
  }

  backToSearch(): void {
    this.stage.set('search');
    this.syncPickupMarker();
    this.fitBoth();
  }

  trafficText(q: FareQuote): string {
    const label = {
      light: this.t('trafficLight'),
      normal: this.t('trafficNormal'),
      busy: this.t('trafficBusy'),
      peak: this.t('trafficPeak'),
    }[q.trafficBand];
    if (q.fareFactor <= 1) return `${label} · ${this.t('standardRate')}`;
    return `${label} · +${Math.round((q.fareFactor - 1) * 100)}%`;
  }

  stepHint(): string {
    if (this.locating() && !this.pickupPoint()) return this.t('locating');
    if (this.locationDenied() && !this.pickupPoint()) return this.t('needLocation');
    if (!this.pickupPoint()) return this.t('needPickup');
    if (!this.dropoffPoint()) return this.t('needDropoff');
    return this.t('hint');
  }

  setLanguage(lang: MapLang): void {
    this.lang.set(lang);
    this.applyTiles(lang);
  }

  onQuery(field: PointField, value: string): void {
    if (field === 'pickup') {
      this.pickupFromUser = true;
      this.pickupQuery.set(value);
    } else this.dropoffQuery.set(value);
    this.activeSearch.set(field);
    this.focusedField.set(field);
    clearTimeout(this.searchTimer);
    if (value.trim().length < 2) {
      this.suggestions.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = setTimeout(() => this.runSearch(field, value.trim()), 350);
  }

  placeLabel(place: PlaceHit): string {
    if (place.distanceKm == null) return place.label;
    const km = place.distanceKm < 10 ? place.distanceKm.toFixed(1) : String(Math.round(place.distanceKm));
    return `${place.label} · ${km} km`;
  }

  choosePlace(field: PointField, place: PlaceHit): void {
    if (field === 'pickup') this.pickupFromUser = true;
    this.searchSeq += 1;
    this.suggestions.set([]);
    this.searching.set(false);
    this.activeSearch.set(null);
    const latlng = L.latLng(place.lat, place.lng);
    const showRides = field === 'dropoff' && this.pickupPoint() != null;
    this.setPoint(field, latlng, place.label, showRides);
    if (showRides) {
      this.confirmPickup();
      return;
    }
    this.map?.setView(latlng, Math.max(this.map.getZoom(), 14));
  }

  book(): void {
    if (this.busy() || this.rideLocked()) return;
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    if (!pickup) {
      this.show(this.t('needPickup'), 'err');
      return;
    }
    if (!dropoff) {
      this.show(this.t('needDropoff'), 'err');
      return;
    }
    if (!this.vehicleTypeId) {
      this.show(this.t('needVehicle'), 'err');
      return;
    }

    this.busy.set(true);
    this.message.set('');
    this.api
      .createRide({
        vehicleTypeId: this.vehicleTypeId,
        paymentMethod: this.paymentMethod,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: this.pickupQuery(),
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: this.dropoffQuery(),
        riderName: this.session.user()?.fullName,
      })
      .subscribe({
        next: (ride) => {
          this.busy.set(false);
          this.rideLocked.set(true);
          this.activeRideId = ride.id;
          this.stage.set('rides');
          this.show(this.rideSummary(ride), 'ok');
        },
        error: (err: { error?: { error?: { message?: string } } }) => {
          this.busy.set(false);
          this.show(err.error?.error?.message ?? 'Could not book', 'err');
        },
      });
  }

  refreshQuote(): void {
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    const list = this.vehicles();
    if (!pickup || !dropoff || list.length === 0) return;
    const seq = ++this.quoteSeq;
    for (const vehicle of list) {
      this.api
        .quote({
          vehicleTypeId: vehicle.id,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
        })
        .subscribe({
          next: (q) => {
            if (seq !== this.quoteSeq) return;
            this.quotes.update((current) => ({ ...current, [vehicle.id]: q }));
            if (vehicle.id === this.vehicleTypeId && this.stage() === 'rides') {
              this.quote.set(q);
              this.drawRoute(q.route);
            }
          },
          error: () => {
            if (vehicle.id === this.vehicleTypeId) this.show(this.t('quoteFailed'), 'err');
          },
        });
    }
  }

  private rideSummary(ride: Ride): string {
    const driver = ride.driver?.fullName;
    const phase =
      ride.status === 'arriving'
        ? this.t('arriving')
        : ride.status === 'in_progress'
          ? this.t('started')
          : ride.status === 'completed'
            ? this.t('completed')
            : ride.status === 'searching'
              ? this.t('searching')
              : ride.status;
    if (driver) return `${this.t('booked')}: ${phase}. ${this.t('driver')}: ${driver}`;
    return `${this.t('booked')}: ${phase}`;
  }

  private moveDriver(lat: number, lng: number): void {
    if (!this.map) return;
    const at: L.LatLngExpression = [lat, lng];
    if (!this.driverMarker) {
      this.driverMarker = L.marker(at, {
        icon: L.divIcon({
          className: 'car-icon',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#f0c14b;border:2px solid #0f1419"></span>',
        }),
        interactive: false,
      }).addTo(this.map);
      return;
    }
    this.driverMarker.setLatLng(at);
  }

  private show(text: string, kind: 'ok' | 'err' | 'info'): void {
    this.messageKind.set(kind);
    this.message.set(text);
  }

  private showServiceCity(): void {
    const city = this.serviceCity;
    if (!city || !this.map || this.pickupFromUser || this.pickupPoint()) return;
    this.map.setView([city.lat, city.lng], 13);
  }

  private useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationDenied.set(true);
      return;
    }
    this.locating.set(true);
    this.locationDenied.set(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.zone.run(() => {
          this.locating.set(false);
          this.locationDenied.set(false);
          if (this.pickupFromUser || !this.map) return;
          const { latitude, longitude } = position.coords;
          const latlng = L.latLng(latitude, longitude);
          this.setPoint('pickup', latlng, this.t('currentLocation'));
          this.map.setView(latlng, 15);
          this.reverseInto('pickup', latlng);
          this.api.rememberCountry(latitude, longitude, this.session.user()?.fullName).subscribe({ error: () => undefined });
        });
      },
      () => this.zone.run(() => {
        this.locating.set(false);
        if (!this.pickupFromUser) this.locationDenied.set(true);
      }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  private applyTiles(_lang: MapLang): void {
    if (!this.map) return;
    this.baseLayer?.remove();
    this.baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);
    this.baseLayer.bringToBack();
  }

  private onMapClick(latlng: L.LatLng): void {
    if (!this.map || this.stage() !== 'search') return;
    const now = Date.now();
    if (now - this.lastPointAt < 300) return;
    this.lastPointAt = now;
    const field = this.focusedField() ?? (this.pickupPoint() ? 'dropoff' : 'pickup');
    if (field === 'pickup') this.pickupFromUser = true;
    const label = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    this.activeSearch.set(null);
    this.suggestions.set([]);
    const showRides = field === 'dropoff' && this.pickupPoint() != null;
    this.setPoint(field, latlng, label, showRides);
    this.reverseInto(field, latlng);
    if (showRides) this.confirmPickup();
  }

  private setPoint(field: PointField, latlng: L.LatLng, label: string, keepView = false): void {
    if (!this.map) return;
    if (field === 'pickup') {
      this.pickupPoint.set(latlng);
      this.pickupQuery.set(label);
      this.pickupMarker?.remove();
      this.pickupMarker = L.circleMarker(latlng, {
        radius: 9,
        color: '#3ddc97',
        fillColor: '#3ddc97',
        fillOpacity: 0.95,
        pane: 'points',
      }).addTo(this.map);
      this.queueNearby(latlng.lat, latlng.lng);
    } else {
      this.dropoffPoint.set(latlng);
      this.dropoffQuery.set(label);
      this.dropoffMarker?.remove();
      this.dropoffMarker = L.circleMarker(latlng, {
        radius: 9,
        color: '#6cb6ff',
        fillColor: '#6cb6ff',
        fillOpacity: 0.95,
        pane: 'points',
      }).addTo(this.map);
    }
    if (this.messageKind() !== 'ok') this.message.set('');
    this.refreshQuote();
    if (!keepView) this.fitBoth();
  }

  private reverseInto(field: PointField, latlng: L.LatLng, attempt = 0): void {
    const token = field === 'pickup' ? ++this.pickupRev : ++this.dropoffRev;
    this.api.reversePlace(latlng.lat, latlng.lng, this.lang()).subscribe({
      next: (place) => {
        const current = field === 'pickup' ? this.pickupRev : this.dropoffRev;
        if (token !== current) return;
        this.writeQuery(field, place?.label?.trim() || this.coordLabel(latlng));
      },
      error: () => {
        const current = field === 'pickup' ? this.pickupRev : this.dropoffRev;
        if (token !== current) return;
        if (attempt < 1) {
          window.setTimeout(() => this.reverseInto(field, latlng, attempt + 1), 400);
          return;
        }
        this.writeQuery(field, this.coordLabel(latlng));
      },
    });
  }

  private writeQuery(field: PointField, value: string): void {
    if (field === 'pickup') this.pickupQuery.set(value);
    else this.dropoffQuery.set(value);
  }

  private coordLabel(latlng: L.LatLng): string {
    return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  }

  private runSearch(field: PointField, query: string): void {
    const seq = ++this.searchSeq;
    const bias = this.pickupPoint() ?? this.map?.getCenter();
    this.api.searchPlaces(query, bias?.lat, bias?.lng, this.lang()).subscribe({
      next: (hits) => {
        if (seq !== this.searchSeq || this.activeSearch() !== field) return;
        this.searching.set(false);
        this.suggestions.set(hits);
      },
      error: () => {
        if (seq !== this.searchSeq) return;
        this.searching.set(false);
        this.suggestions.set([]);
      },
    });
  }

  private queueNearby(lat: number, lng: number): void {
    clearTimeout(this.carsTimer);
    this.carsTimer = setTimeout(() => {
      this.api.nearbyCars(lat, lng).subscribe({
        next: (cars) => {
          this.nearbyCars.set(cars);
          this.drawCars(cars);
        },
      });
    }, 200);
  }

  private drawCars(cars: NearbyCar[]): void {
    if (!this.map) return;
    for (const marker of this.carMarkers) marker.remove();
    this.carMarkers = cars.map((car) =>
      L.marker([car.lat, car.lng], {
        icon: this.carIcon(car),
        interactive: false,
        keyboard: false,
      }).addTo(this.map!),
    );
  }

  private carIcon(car: NearbyCar): L.DivIcon {
    const color = CAR_COLOR[car.vehicleCode];
    return L.divIcon({
      className: 'car-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <g transform="rotate(${car.heading} 14 14)">
          <rect x="8" y="3" width="12" height="22" rx="4" fill="${color}" stroke="#0f1419" stroke-width="1.5"/>
          <rect x="10" y="6" width="8" height="5" rx="1.2" fill="#f4f7fb"/>
          <rect x="10" y="15" width="8" height="4" rx="1" fill="#f4f7fb"/>
        </g>
      </svg>`,
    });
  }

  private drawRoute(coords: Array<[number, number]>): void {
    if (!this.map) return;
    this.routeLine?.remove();
    if (!coords || coords.length < 2) return;
    this.routeLine = L.polyline(coords, { color: '#3ddc97', weight: 5, opacity: 0.9 }).addTo(this.map);
    const bottom = Math.round(this.map.getSize().y * 0.42);
    this.map.fitBounds(this.routeLine.getBounds(), {
      paddingTopLeft: L.point(40, 56),
      paddingBottomRight: L.point(40, bottom),
      maxZoom: 15,
    });
  }

  private latLngUnderPin(): L.LatLng | null {
    if (!this.map) return null;
    return this.map.containerPointToLatLng(this.pinPoint());
  }

  private pinPoint(): L.Point {
    const size = this.map!.getSize();
    const y = size.x >= 900 ? size.y / 2 : (size.y - 260) / 2;
    return L.point(size.x / 2, y);
  }

  private showPickupOnPin(): void {
    const pickup = this.pickupPoint();
    if (!this.map || !pickup) return;
    const zoom = 17;
    this.map.invalidateSize({ animate: false, pan: false });
    const pin = this.pinPoint();
    const size = this.map.getSize();
    const projected = this.map.project(pickup, zoom);
    const center = projected.add(L.point(size.x / 2 - pin.x, size.y / 2 - pin.y));
    this.userDragging = false;
    this.map.setView(this.map.unproject(center, zoom), zoom, { animate: false });
  }

  private syncPickupMarker(): void {
    const latlng = this.pickupPoint();
    if (!this.map || !latlng) return;
    this.pickupMarker?.remove();
    this.pickupMarker = undefined;
    if (this.stage() === 'pickup') return;
    this.pickupMarker = L.circleMarker(latlng, {
      radius: 9,
      color: '#111',
      fillColor: '#111',
      fillOpacity: 0.95,
      pane: 'points',
    }).addTo(this.map);
  }

  private fitBoth(): void {
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    if (!this.map || !pickup || !dropoff) return;
    const bottom = this.stage() === 'search' ? 240 : 48;
    this.map.fitBounds(L.latLngBounds(pickup, dropoff), {
      paddingTopLeft: L.point(48, 48),
      paddingBottomRight: L.point(48, bottom),
      maxZoom: 15,
    });
  }
}
