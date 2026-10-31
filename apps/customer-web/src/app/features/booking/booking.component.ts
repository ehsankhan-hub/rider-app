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
    vehicle: 'Choose a car',
    seats: 'seats',
    pay: 'Pay with',
    cash: 'Cash',
    wallet: 'Wallet',
    confirm: 'Confirm ride',
    booking: 'Booking…',
    lang: 'Map language',
    locating: 'Finding your location…',
    currentLocation: 'Current location',
    outsideCity: 'This is your location. It is outside the service city, so nearby cars may not be available.',
    needPickup: 'Choose a pickup from search or the map.',
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
    vehicle: 'اختر السيارة',
    seats: 'مقاعد',
    pay: 'الدفع',
    cash: 'نقداً',
    wallet: 'المحفظة',
    confirm: 'تأكيد الرحلة',
    booking: 'جارٍ الحجز…',
    lang: 'لغة الخريطة',
    locating: 'جارٍ تحديد موقعك…',
    currentLocation: 'موقعك الحالي',
    outsideCity: 'هذا موقعك. هو خارج مدينة الخدمة، وقد لا تتوفر سيارات قريبة.',
    needPickup: 'حدد الانطلاق بالبحث أو من الخريطة.',
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

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="layout" [attr.dir]="lang() === 'ar' ? 'rtl' : 'ltr'">
      <div #mapHost class="map"></div>
      <aside class="card panel">
        <div class="panel-body">
          <div class="row">
            <h2>{{ t('title') }}</h2>
            <label class="lang">
              {{ t('lang') }}
              <select [ngModel]="lang()" (ngModelChange)="setLanguage($event)">
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </label>
          </div>
          <p class="hint step">{{ stepHint() }}</p>
          <label class="place">
            {{ t('pickup') }}
            <input
              [ngModel]="pickupQuery()"
              (ngModelChange)="onQuery('pickup', $event)"
              (focus)="focusedField.set('pickup')"
              [placeholder]="locating() ? t('locating') : t('pickupPh')"
              autocomplete="off"
            />
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
          </label>
          <label class="place">
            {{ t('dropoff') }}
            <input
              [ngModel]="dropoffQuery()"
              (ngModelChange)="onQuery('dropoff', $event)"
              (focus)="focusedField.set('dropoff')"
              [placeholder]="t('dropoffPh')"
              autocomplete="off"
            />
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
          </label>
          @if (nearbyCars().length) {
            <div class="nearby">
              <b>{{ t('nearby') }}</b>
              <ul>
                @for (car of nearbyCars(); track car.id) {
                  <li>
                    <span class="dot" [style.background]="carColor(car)"></span>
                    {{ car.displayName }}
                    <span>{{ car.etaMin }} {{ t('min') }}</span>
                  </li>
                }
              </ul>
            </div>
          }
          <div class="fleet">
            <b>{{ t('vehicle') }}</b>
            <div class="fleet-row">
              @for (v of orderedVehicles(); track v.id) {
                <button
                  type="button"
                  class="car-card"
                  [class.on]="vehicleTypeId === v.id"
                  (click)="selectVehicle(v.id)"
                >
                  <img [src]="carImage(v.code)" [alt]="v.displayName" />
                  <strong>{{ v.displayName }}</strong>
                  <span>{{ v.capacity }} {{ t('seats') }}</span>
                  @if (etaFor(v.code); as eta) {
                    <span>{{ eta }} {{ t('min') }}</span>
                  }
                </button>
              }
            </div>
          </div>
          <label>
            {{ t('pay') }}
            <select [(ngModel)]="paymentMethod">
              <option value="CASH">{{ t('cash') }}</option>
              <option value="WALLET">{{ t('wallet') }}</option>
            </select>
          </label>
        </div>
        <div class="panel-foot">
          @if (quote(); as q) {
            <div class="quote">
              <div class="top">
                <span>{{ q.distanceKm }} km · {{ q.durationMin }} {{ t('min') }}</span>
                <strong>{{ q.currency }} {{ q.fareAmount }}</strong>
              </div>
              <small class="basis" [class.peak]="q.trafficBand === 'peak'" [class.busy]="q.trafficBand === 'busy'">
                {{ trafficText(q) }}
              </small>
            </div>
          }
          @if (message()) {
            <p class="status" [class.ok]="messageKind() === 'ok'" [class.err]="messageKind() === 'err'">
              {{ message() }}
            </p>
          }
          <button type="button" (click)="book()" [disabled]="busy() || rideLocked()">
            {{ busy() ? t('booking') : rideLocked() ? t('booked') : t('confirm') }}
          </button>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; min-height: 0; }
      .layout { height: 100%; min-height: 0; display: grid; grid-template-columns: 1fr 400px; }
      .map { height: 100%; min-height: 0; }
      .panel {
        margin: 16px 16px 28px;
        min-height: 0;
        max-height: calc(100% - 44px);
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 14px;
        position: relative;
        z-index: 2;
        overflow: hidden;
      }
      .panel-body { display: grid; gap: 12px; min-height: 0; overflow: auto; }
      .panel-foot { display: grid; gap: 10px; flex-shrink: 0; }
      .step { color: var(--text); font-weight: 600; }
      .row { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
      h2 { margin: 0; }
      .lang { font-size: 12px; color: var(--muted); min-width: 140px; }
      .hint, p { color: var(--muted); margin: 0; }
      .place { display: grid; gap: 6px; }
      .suggest {
        list-style: none;
        margin: 0;
        padding: 4px;
        background: #12181f;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .suggest button {
        width: 100%;
        text-align: start;
        background: transparent;
        color: var(--text);
        font-weight: 500;
        padding: 8px 10px;
      }
      .suggest button:hover { background: #1c2632; }
      .suggest .empty { padding: 8px 10px; color: var(--muted); }
      .nearby { display: grid; gap: 6px; }
      .nearby b { color: var(--text); font-size: 13px; }
      .nearby ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
      .nearby li { display: flex; align-items: center; gap: 8px; color: var(--text); font-size: 13px; }
      .nearby li span:last-child { margin-inline-start: auto; color: var(--muted); }
      .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
      .fleet { display: grid; gap: 8px; }
      .fleet > b { color: var(--text); font-size: 13px; }
      .fleet-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .car-card {
        background: #12181f;
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 8px 6px 10px;
        display: grid;
        justify-items: center;
        gap: 2px;
        font-weight: 600;
      }
      .car-card img {
        width: calc(100% + 12px);
        height: 78px;
        margin: -8px -6px 2px;
        object-fit: cover;
        object-position: center;
        border-radius: 11px 11px 0 0;
      }
      .car-card strong { font-size: 13px; }
      .car-card span { color: var(--muted); font-size: 11px; font-weight: 500; }
      .car-card.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
      .quote { display: grid; gap: 2px; color: var(--text); }
      .quote .top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .basis { color: var(--muted); font-size: 12px; }
      .basis.busy { color: #f0c14b; }
      .basis.peak { color: #ffb020; }
      .status { margin: 0; padding: 10px 12px; border-radius: 10px; }
      .status.ok { color: #06281a; background: var(--accent); }
      .status.err { color: #fff; background: var(--danger); }
      .panel-foot button { width: 100%; }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
      @media (max-width: 900px) {
        .layout { grid-template-columns: 1fr; grid-template-rows: 50vh auto; }
        .panel { max-height: none; margin-bottom: 24px; }
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
  private pickupRev = 0;
  private dropoffRev = 0;
  private lastPointAt = 0;

  vehicles = signal<VehicleType[]>([]);
  quote = signal<FareQuote | null>(null);
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
  private serviceCity: { lat: number; lng: number; label: string } | null = null;
  nearbyCars = signal<NearbyCar[]>([]);

  vehicleTypeId = '';
  paymentMethod: 'CASH' | 'WALLET' = 'CASH';
  private readonly pickupPoint = signal<L.LatLng | null>(null);
  private readonly dropoffPoint = signal<L.LatLng | null>(null);

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
    this.map.on('moveend', () => {
      this.zone.run(() => {
        if (this.pickupPoint() || !this.map) return;
        const mapCenter = this.map.getCenter();
        this.queueNearby(mapCenter.lat, mapCenter.lng);
      });
    });
    setTimeout(() => this.map?.invalidateSize(), 50);
    this.api.runtime().subscribe({
      next: (config) => {
        const label = [config.city.name, config.city.state].filter((part) => part.length > 0).join(', ');
        this.serviceCity = {
          lat: config.city.lat,
          lng: config.city.lng,
          label: label || config.city.name,
        };
        if (!this.pickupFromUser) this.placeAtServiceCity();
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
    this.refreshQuote();
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
    this.setPoint(field, latlng, place.label);
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
    if (!pickup || !dropoff || !this.vehicleTypeId) return;
    this.api
      .quote({
        vehicleTypeId: this.vehicleTypeId,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
      })
      .subscribe({
        next: (q) => {
          this.quote.set(q);
          this.drawRoute(q.route);
        },
        error: () => this.show(this.t('quoteFailed'), 'err'),
      });
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

  private placeAtServiceCity(): void {
    const city = this.serviceCity;
    if (!city || !this.map || this.pickupFromUser) return;
    const latlng = L.latLng(city.lat, city.lng);
    this.setPoint('pickup', latlng, city.label);
    this.map.setView(latlng, 13);
    this.reverseInto('pickup', latlng);
  }

  private useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.placeAtServiceCity();
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.zone.run(() => {
          this.locating.set(false);
          if (this.pickupFromUser || !this.map) return;
          const { latitude, longitude } = position.coords;
          const latlng = L.latLng(latitude, longitude);
          this.setPoint('pickup', latlng, this.t('currentLocation'));
          this.map.setView(latlng, 15);
          this.reverseInto('pickup', latlng);
        });
      },
      () => this.zone.run(() => {
        this.locating.set(false);
        this.placeAtServiceCity();
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
    if (!this.map) return;
    const now = Date.now();
    if (now - this.lastPointAt < 300) return;
    this.lastPointAt = now;
    const field = this.focusedField() ?? (this.pickupPoint() ? 'dropoff' : 'pickup');
    if (field === 'pickup') this.pickupFromUser = true;
    const label = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    this.activeSearch.set(null);
    this.suggestions.set([]);
    this.setPoint(field, latlng, label);
    this.reverseInto(field, latlng);
  }

  private setPoint(field: PointField, latlng: L.LatLng, label: string): void {
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
    this.fitBoth();
  }

  private reverseInto(field: PointField, latlng: L.LatLng): void {
    const token = field === 'pickup' ? ++this.pickupRev : ++this.dropoffRev;
    this.api.reversePlace(latlng.lat, latlng.lng, this.lang()).subscribe({
      next: (place) => {
        const current = field === 'pickup' ? this.pickupRev : this.dropoffRev;
        if (!place || token !== current) return;
        if (field === 'pickup') this.pickupQuery.set(place.label);
        else this.dropoffQuery.set(place.label);
      },
    });
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
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [48, 48], maxZoom: 15 });
  }

  private fitBoth(): void {
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    if (!this.map || !pickup || !dropoff) return;
    this.map.fitBounds(L.latLngBounds(pickup, dropoff), { padding: [48, 48], maxZoom: 15 });
  }
}
