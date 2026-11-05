import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, NgZone, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { DriverApiService, DriverRide, DriverSummary } from '../core/driver-api.service';
import { SessionService } from '../core/session.service';

const NEXT: Record<string, { status: 'arriving' | 'in_progress' | 'completed'; label: string }> = {
  assigned: { status: 'arriving', label: "I've arrived" },
  arriving: { status: 'in_progress', label: 'Start trip' },
  in_progress: { status: 'completed', label: 'End trip' },
};

const STAGE: Record<string, string> = {
  assigned: 'Heading to pickup',
  arriving: 'Waiting for the rider',
  in_progress: 'Trip in progress',
};

function failureReason(err: unknown, fallback: string): string {
  if (!(err instanceof HttpErrorResponse)) {
    return err instanceof Error && err.message ? err.message : fallback;
  }
  const body = typeof err.error === 'string' ? parseBody(err.error) : err.error;
  const record = body && typeof body === 'object' ? (body as { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } }; message?: string }) : null;
  const message = record?.error?.message ?? record?.message;
  const fields = record?.error?.details?.fieldErrors;
  const field = fields && Object.entries(fields).find((entry) => entry[1]?.length);
  if (field) return `${field[0]}: ${field[1][0]}`;
  if (typeof message === 'string' && message.length > 0 && message !== 'Invalid request') return message;
  if (err.status === 0) return 'The ride service did not answer. Try again in a moment.';
  if (err.status === 401) return 'Your sign-in expired. Sign in again.';
  if (err.status === 403) return 'This account is not allowed to go online.';
  if (err.status >= 500) return 'The ride service failed. Try again in a moment.';
  if (err.status) return `${fallback} (${err.status}).`;
  return fallback;
}

function parseBody(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-shift',
  standalone: true,
  imports: [],
  template: `
    <div class="layout">
      <div #mapHost class="map"></div>
      <aside class="panel">
        <nav class="tabs">
          <button type="button" [class.on]="tab() === 'home'" (click)="tab.set('home')">Home</button>
          <button type="button" [class.on]="tab() === 'earnings'" (click)="openEarnings()">Earnings</button>
          <button type="button" [class.on]="tab() === 'account'" (click)="tab.set('account')">Account</button>
        </nav>
        <header class="hero">
          <div class="avatar">{{ initial() }}</div>
          <div class="who">
            <h2>{{ session.user()?.fullName }}</h2>
            <p class="status" [class.live]="online()"><i></i>{{ online() ? 'Online' : 'Offline' }} · {{ summary()?.vehicle || 'Vehicle not set' }}</p>
          </div>
          <div class="today">
            <strong>{{ money(summary()?.today?.fare) }}</strong>
            <span>{{ summary()?.today?.trips ?? 0 }} trips today</span>
            <button class="ghost signout" type="button" (click)="logout()">Sign out</button>
          </div>
        </header>
        <div class="sheet" [class.can-scroll]="tab() !== 'home'">
          @if (tab() === 'home') {
            @if (!online()) {
              <section class="block">
                <label>
                  Vehicle
                  <input [value]="summary()?.vehicle || 'Not set'" disabled />
                </label>
                <p class="hint">Chosen when you created your account.</p>
                @if (!summary()?.vehicleTypeId) {
                  <p class="err">You cannot go online yet. This account has no vehicle type.</p>
                }
                <p class="hint">
                  @if (here()) {
                    Position set. Riders will see this gold dot.
                  } @else if (secure) {
                    Allow the location prompt, or tap the map to set where you are.
                  } @else {
                    This phone page is not secure, so the browser will not share GPS. Tap the map to set where you are.
                  }
                </p>
                <button type="button" (click)="goOnline()" [disabled]="busy() || !summary()?.vehicleTypeId">Go online</button>
              </section>
            }
            @if (online()) {
              @if (ride(); as trip) {
                <section class="block trip-card">
                  <div class="details">
                  <div class="fare">
                    <div>
                      <p class="stage">{{ stage(trip) }}</p>
                      <p class="hint">{{ firstName(trip) }} · {{ km(trip) }} km · {{ minutes(trip) }} min</p>
                    </div>
                    <div class="amount">
                      <strong>{{ money(trip.fareAmount) }}</strong>
                      <span>{{ payLabel(trip) }}</span>
                    </div>
                  </div>
                  <ol class="steps">
                    <li [class.on]="trip.status === 'assigned' && !atPickup(trip)">To pickup</li>
                    <li [class.on]="trip.status === 'arriving' || (trip.status === 'assigned' && atPickup(trip))">Arrived</li>
                    <li [class.on]="trip.status === 'in_progress'">On trip</li>
                  </ol>
                  <div class="stop pickup">
                    <span>Pickup</span>
                    <b>{{ trip.pickupAddress }}</b>
                  </div>
                  <div class="stop dropoff">
                    <span>Drop-off</span>
                    <b>{{ trip.dropoffAddress }}</b>
                  </div>
                  </div>
                  <div class="actions">
                    <a class="nav" [href]="navHref(trip)" target="_blank" rel="noopener">{{ navLabel(trip) }}</a>
                    @if (stopPrompt()) {
                      <p class="hint">{{ stopPrompt() }}</p>
                      <button type="button" (click)="confirmStop(trip)" [disabled]="busy()">Rider got out here</button>
                      <button class="ghost" type="button" (click)="keepGoing()" [disabled]="busy()">Keep going</button>
                    } @else if (noShowPrompt()) {
                      @if (atPickup(trip)) {
                        <p class="hint">The rider is not at the pickup. End this trip with no fare?</p>
                      } @else {
                        <p class="err">Stay at the pickup first. You are {{ awayLabel(trip) }} from it.</p>
                      }
                      @if (error()) { <p class="err">{{ error() }}</p> }
                      <button type="button" (click)="riderMissing(trip)" [disabled]="busy() || !atPickup(trip)">Rider not here</button>
                      <button class="ghost" type="button" (click)="noShowPrompt.set(false)" [disabled]="busy()">Keep waiting</button>
                    } @else if (passPrompt()) {
                      <p class="hint">Pass this trip so another driver can take it?</p>
                      <button type="button" (click)="pass(trip)" [disabled]="busy()">Pass trip</button>
                      <button class="ghost" type="button" (click)="passPrompt.set(false)" [disabled]="busy()">Keep it</button>
                    } @else {
                      @if (error()) { <p class="err">{{ error() }}</p> }
                      @if (trip.status === 'assigned' && !atPickup(trip)) {
                        <p class="hint">Go to the pickup first. You are {{ awayLabel(trip) }} away.</p>
                      }
                      @if (nextAction(trip); as action) {
                        <button type="button" (click)="advance(trip, action.status)" [disabled]="busy() || !canAdvance(trip, action.status)">{{ action.label }}</button>
                      }
                      @if (trip.status === 'arriving' && waitLeft(trip) === 0) {
                        <button class="ghost" type="button" (click)="noShowPrompt.set(true)" [disabled]="busy()">Rider not here</button>
                      }
                      @if (trip.status === 'assigned' || trip.status === 'arriving') {
                        <button class="ghost" type="button" (click)="passPrompt.set(true)" [disabled]="busy()">Pass trip</button>
                      }
                    }
                  </div>
                </section>
                <button class="ghost slim" type="button" (click)="goOffline()" [disabled]="busy()">Go offline</button>
              } @else {
                <section class="block wait">
                  <p class="stage">Waiting for a trip</p>
                  <p class="hint">Keep this page open. The screen stays on so your location keeps updating. If you lock the phone, location pauses until you open this page again.</p>
                  <button class="ghost" type="button" (click)="goOffline()" [disabled]="busy()">Go offline</button>
                </section>
              }
            }
          } @else if (tab() === 'earnings') {
            <div class="stats">
              <div>
                <span>Today</span>
                <strong>{{ money(summary()?.today?.fare) }}</strong>
                <em>{{ summary()?.today?.trips ?? 0 }} trips</em>
              </div>
              <div>
                <span>This week</span>
                <strong>{{ money(summary()?.week?.fare) }}</strong>
                <em>{{ summary()?.week?.trips ?? 0 }} trips</em>
              </div>
            </div>
            <h3>Recent trips</h3>
            @if ((summary()?.recent?.length ?? 0) === 0) {
              <p class="hint">Completed trips this week show up here.</p>
            }
            @for (trip of summary()?.recent ?? []; track trip.id) {
              <article class="earn">
                <div>
                  <span>{{ when(trip.completedAt) }} · {{ trip.paymentMethod === 'CASH' ? 'Cash' : 'In app' }} · {{ distance(trip.distanceKm) }} km</span>
                  <b>{{ trip.pickupAddress }}</b>
                  <b class="to">{{ trip.dropoffAddress }}</b>
                </div>
                <strong>{{ money(trip.fareAmount) }}</strong>
              </article>
            }
          } @else {
            <section class="block account">
              <div class="field"><span>Name</span><b>{{ session.user()?.fullName }}</b></div>
              <div class="field"><span>Phone</span><b>{{ session.user()?.phone || 'Not set' }}</b></div>
              <div class="field"><span>Email</span><b>{{ session.user()?.email }}</b></div>
              <div class="field"><span>Vehicle</span><b>{{ summary()?.vehicle || 'Not set' }}</b></div>
              <div class="field"><span>Online since</span><b>{{ summary()?.onlineSince ? when(summary()!.onlineSince!) : 'Offline' }}</b></div>
            </section>
          }
          @if (error()) { <p class="err">{{ error() }}</p> }
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .layout { height: 100%; display: grid; grid-template-columns: 60% 40%; background: var(--bg); }
      .map { height: 100%; min-width: 0; }
      .panel {
        min-width: 0;
        min-height: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 20px 12px;
        background: var(--panel);
        border-left: 1px solid var(--line);
        overflow: hidden;
      }
      .hero { display: flex; align-items: center; gap: 12px; }
      .avatar {
        width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center;
        background: #243447; color: var(--accent); font-weight: 700; font-size: 18px; flex: none;
      }
      .who { min-width: 0; }
      .who h2 { margin: 0; font-size: 22px; }
      .today { margin-left: auto; text-align: right; display: grid; justify-items: end; gap: 4px; }
      .signout { padding: 8px 12px; }
      .today strong { display: block; font-size: 22px; }
      .today span, .hint, .status, .field span, .earn span, .stats span, .stats em, .amount span { color: var(--muted); font-size: 13px; font-style: normal; }
      .status { display: flex; align-items: center; gap: 8px; margin: 4px 0 0; }
      .status i { width: 8px; height: 8px; border-radius: 50%; background: #66788a; display: block; }
      .status.live { color: var(--accent); }
      .status.live i { background: var(--accent); box-shadow: 0 0 0 4px rgba(61, 220, 151, 0.16); }
      .sheet { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
      .sheet.can-scroll { overflow: auto; scrollbar-width: thin; scrollbar-color: #3a4654 transparent; }
      .sheet.can-scroll::-webkit-scrollbar { width: 8px; }
      .sheet.can-scroll::-webkit-scrollbar-thumb { background: #3a4654; border-radius: 8px; }
      .trip-card { flex: 1; grid-template-rows: auto auto; align-content: start; }
      .details { display: grid; gap: 10px; align-content: start; }
      .actions {
        display: grid;
        gap: 8px;
        padding-top: 4px;
        background: #12181f;
      }
      .block { background: #12181f; border: 1px solid var(--line); border-radius: 16px; padding: 14px; display: grid; gap: 10px; }
      h3, p { margin: 0; }
      h3 { font-size: 14px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
      label { display: grid; gap: 8px; color: var(--muted); font-size: 13px; }
      input:disabled { color: var(--text); opacity: 1; cursor: not-allowed; }
      .stage { font-size: 18px; font-weight: 700; }
      a.nav {
        display: block;
        text-align: center;
        text-decoration: none;
        background: var(--accent);
        color: #06281a;
        border-radius: 12px;
        padding: 12px 14px;
        font-weight: 700;
      }
      .fare { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .amount { text-align: right; }
      .amount strong { display: block; font-size: 24px; line-height: 1.1; }
      .steps { display: flex; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .steps li { flex: 1; text-align: center; font-size: 12px; color: var(--muted); background: #1a2430; border-radius: 999px; padding: 6px 8px; }
      .steps li.on { color: #06281a; background: var(--accent); font-weight: 700; }
      .stop { display: grid; gap: 2px; padding-left: 14px; border-left: 3px solid var(--line); }
      .stop span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
      .stop.pickup { border-color: var(--accent); }
      .stop.dropoff { border-color: #6cb6ff; }
      .wait { min-height: 160px; align-content: center; }
      .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .stats div { background: #12181f; border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: grid; gap: 4px; }
      .stats strong { font-size: 26px; }
      .earn { display: flex; justify-content: space-between; gap: 16px; align-items: center; background: #12181f; border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
      .earn div { display: grid; gap: 2px; min-width: 0; }
      .earn b, .field b { overflow-wrap: anywhere; }
      .earn .to { color: #d5deea; font-weight: 500; }
      .earn > strong { font-size: 18px; white-space: nowrap; }
      .account { padding: 6px 16px; }
      .field { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); }
      .field:last-child { border-bottom: 0; }
      .field b { text-align: right; }
      .tabs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #12181f; border-radius: 14px; padding: 6px; }
      .tabs button { background: transparent; color: var(--muted); border-radius: 10px; }
      .tabs button.on { background: var(--accent); color: #06281a; }
      .slim { justify-self: start; }
      button:disabled { cursor: not-allowed; opacity: 0.55; }
      .err { color: #fff; background: var(--danger); padding: 10px 12px; border-radius: 10px; }
      @media (max-width: 980px) {
        .layout { grid-template-columns: 1fr; grid-template-rows: 22vh minmax(0, 1fr); }
        .panel { border-left: 0; border-top: 1px solid var(--line); padding: 12px 14px; }
      }
      @media (max-height: 760px) {
        .panel { gap: 8px; padding: 10px 14px 8px; }
        .avatar { width: 36px; height: 36px; font-size: 16px; }
        .who h2, .today strong { font-size: 18px; }
        .block { padding: 10px; gap: 8px; }
        .stage { font-size: 16px; }
        .amount strong { font-size: 20px; }
      }
    `,
  ],
})
export class ShiftComponent implements OnDestroy {
  private readonly api = inject(DriverApiService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  readonly session = inject(SessionService);
  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private map?: L.Map;
  private pickupMarker?: L.CircleMarker;
  private dropoffMarker?: L.CircleMarker;
  private routeLine?: L.Polyline;
  private routeKey = '';
  private selfMarker?: L.CircleMarker;
  private watchId = 0;
  private pulse?: ReturnType<typeof setInterval>;
  private wakeLock: WakeLockSentinel | null = null;
  private readonly onVisible = (): void => {
    if (document.visibilityState !== 'visible' || !this.online()) return;
    void this.holdAwake();
    this.pushLocation();
  };

  summary = signal<DriverSummary | null>(null);
  tab = signal<'home' | 'earnings' | 'account'>('home');
  here = signal<{ lat: number; lng: number } | null>(null);
  readonly secure = typeof window !== 'undefined' && window.isSecureContext;
  online = signal(false);
  ride = signal<DriverRide | null>(null);
  busy = signal(false);
  error = signal('');
  stopPrompt = signal('');
  passPrompt = signal(false);
  noShowPrompt = signal(false);
  private readonly now = signal(Date.now());
  private clock?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const update = this.api.liveRide();
      if (!update) return;
      const mine = !update.driver?.userId || update.driver.userId === this.session.user()?.id;
      if (update.status === 'completed' || update.status === 'cancelled' || update.status === 'searching' || !mine) {
        this.stopPrompt.set('');
        this.passPrompt.set(false);
        this.noShowPrompt.set(false);
        this.ride.set(null);
        this.clearTrip();
        if (update.status === 'completed') this.loadSummary();
        return;
      }
      if (update.status !== 'in_progress') this.stopPrompt.set('');
      const had = this.ride();
      if (!had || had.id !== update.id) {
        this.tab.set('home');
        this.passPrompt.set(false);
        this.noShowPrompt.set(false);
      }
      if (update.status !== 'arriving') this.noShowPrompt.set(false);
      if (update.status !== 'assigned' && update.status !== 'arriving') this.passPrompt.set(false);
      this.ride.set(update);
      this.drawTrip(update);
    });
  }

  ngAfterViewInit(): void {
    const host = this.mapHost().nativeElement;
    this.map = L.map(host).setView([24.7136, 46.6753], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);
    this.map.on('click', (event) => {
      this.zone.run(() => this.placeSelf(event.latlng.lat, event.latlng.lng));
    });
    setTimeout(() => this.map?.invalidateSize(), 50);
    this.clock = setInterval(() => this.zone.run(() => this.now.set(Date.now())), 1000);
    this.readGps((lat, lng) => {
      if (!this.here()) this.placeSelf(lat, lng);
    });
    this.api.connect();
    this.loadSummary();
    this.api.active().subscribe({
      next: (trip) => {
        if (!trip) return;
        this.online.set(true);
        this.ride.set(trip);
        this.drawTrip(trip);
        this.watch();
      },
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    if (this.clock) clearInterval(this.clock);
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    this.stopPresence();
    this.map?.remove();
  }

  nextAction(trip: DriverRide) {
    return NEXT[trip.status] ?? null;
  }

  canAdvance(trip: DriverRide, status: 'arriving' | 'in_progress' | 'completed'): boolean {
    if (status === 'arriving') return this.atPickup(trip);
    return true;
  }

  stage(trip: DriverRide): string {
    if (trip.status === 'arriving' && this.waitLeft(trip) > 0) {
      return `Waiting for the rider · ${this.waitLabel(trip)}`;
    }
    return STAGE[trip.status] ?? trip.status;
  }

  waitLeft(trip: DriverRide): number {
    const ends = trip.noShowAt
      ? new Date(trip.noShowAt).getTime()
      : trip.arrivedAt
        ? new Date(trip.arrivedAt).getTime() + 5 * 60 * 1000
        : Number.NaN;
    if (!Number.isFinite(ends)) return 5 * 60 * 1000;
    return Math.max(0, ends - this.now());
  }

  waitLabel(trip: DriverRide): string {
    const total = Math.ceil(this.waitLeft(trip) / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  atPickup(trip: DriverRide): boolean {
    const here = this.here();
    if (!here) return false;
    return this.apartKm(here.lat, here.lng, Number(trip.pickupLat), Number(trip.pickupLng)) <= 0.3;
  }

  awayLabel(trip: DriverRide): string {
    const here = this.here();
    if (!here) return 'an unknown distance';
    const km = this.apartKm(here.lat, here.lng, Number(trip.pickupLat), Number(trip.pickupLng));
    if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
    return `${km.toFixed(1)} km`;
  }

  firstName(trip: DriverRide): string {
    const name = trip.riderName?.trim() || 'Rider';
    return name.split(' ')[0] || name;
  }

  payLabel(trip: DriverRide): string {
    return trip.paymentMethod === 'WALLET' ? 'Paid in the app' : 'Collect cash';
  }

  money(amount: string | number | null | undefined): string {
    const symbol = this.summary()?.currency.symbol ?? '₹';
    const value = Number(amount ?? 0);
    return `${symbol}${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
  }

  km(trip: DriverRide): string {
    return this.distance(trip.distanceKm);
  }

  minutes(trip: DriverRide): string {
    const value = Number(trip.durationMin ?? 0);
    return Number.isFinite(value) ? String(Math.round(value)) : '0';
  }

  distance(value: string | number | null | undefined): string {
    const km = Number(value ?? 0);
    return Number.isFinite(km) ? km.toFixed(1) : '0.0';
  }

  when(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  initial(): string {
    return (this.session.user()?.fullName ?? 'D').trim().charAt(0).toUpperCase();
  }

  openEarnings(): void {
    this.tab.set('earnings');
    this.loadSummary();
  }

  navLabel(trip: DriverRide): string {
    return this.navLeg(trip).kind === 'pickup' ? 'Navigate to pickup' : 'Navigate to drop-off';
  }

  navHref(trip: DriverRide): string {
    const leg = this.navLeg(trip);
    return `https://www.google.com/maps/dir/?api=1&origin=${leg.origin.lat},${leg.origin.lng}&destination=${leg.destination.lat},${leg.destination.lng}&travelmode=driving&dir_action=navigate`;
  }

  /** Pickup while the car is still away from the rider. The booked drop-off once the car is already there. */
  private navLeg(trip: DriverRide): {
    kind: 'pickup' | 'dropoff';
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  } {
    const pickup = { lat: Number(trip.pickupLat), lng: Number(trip.pickupLng) };
    const dropoff = { lat: Number(trip.dropoffLat), lng: Number(trip.dropoffLng) };
    const here = this.here();
    const nearPickup = !!here && this.apartKm(here.lat, here.lng, pickup.lat, pickup.lng) <= 0.3;
    if (trip.status !== 'in_progress' && here && !nearPickup) {
      return { kind: 'pickup', origin: here, destination: pickup };
    }
    const movedOff = trip.status === 'in_progress' && !!here && this.apartKm(here.lat, here.lng, pickup.lat, pickup.lng) > 0.3;
    return { kind: 'dropoff', origin: movedOff && here ? here : pickup, destination: dropoff };
  }

  private apartKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  riderMissing(trip: DriverRide): void {
    const here = this.here();
    this.busy.set(true);
    this.error.set('');
    this.api.noShow(trip.id, here ? { lat: here.lat, lng: here.lng } : {}).subscribe({
      next: () => {
        this.noShowPrompt.set(false);
        this.ride.set(null);
        this.clearTrip();
        this.busy.set(false);
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(failureReason(err, 'Could not end the trip'));
        this.busy.set(false);
      },
    });
  }

  pass(trip: DriverRide): void {
    this.busy.set(true);
    this.error.set('');
    this.api.pass(trip.id).subscribe({
      next: () => {
        this.passPrompt.set(false);
        this.ride.set(null);
        this.clearTrip();
        this.busy.set(false);
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(failureReason(err, 'Could not pass the trip'));
        this.busy.set(false);
      },
    });
  }

  goOnline(): void {
    const point = this.here();
    this.error.set('');
    if (point) {
      this.startShift(point.lat, point.lng);
      return;
    }
    this.busy.set(true);
    this.readGps(
      (lat, lng) => {
        this.placeSelf(lat, lng);
        this.startShift(lat, lng);
      },
      (failed) => {
        this.error.set(
          failed
            ? 'Location is blocked. Tap the map where you are, then press Go online.'
            : 'GPS did not answer. Tap the map where you are, then press Go online.',
        );
        this.busy.set(false);
      },
    );
  }

  goOffline(): void {
    this.busy.set(true);
    this.api.offline().subscribe({
      next: () => {
        if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
        this.watchId = 0;
        this.stopPresence();
        this.online.set(false);
        this.loadSummary();
        this.busy.set(false);
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(failureReason(err, 'Finish the trip first'));
        this.busy.set(false);
      },
    });
  }

  advance(trip: DriverRide, status: 'arriving' | 'in_progress' | 'completed'): void {
    this.error.set('');
    if (status === 'completed') {
      this.finish(trip, false);
      return;
    }
    if (status === 'in_progress' && trip.status === 'assigned') {
      this.busy.set(true);
      this.api.setStatus(trip.id, 'arriving').subscribe({
        next: () => {
          this.api.setStatus(trip.id, 'in_progress').subscribe({
            next: (updated) => {
              this.ride.set(updated);
              this.busy.set(false);
            },
            error: (err: { error?: { error?: { message?: string; code?: string } } }) => {
              this.error.set(failureReason(err, 'Could not update the trip'));
              this.busy.set(false);
            },
          });
        },
        error: (err: { error?: { error?: { message?: string; code?: string } } }) => {
          this.error.set(failureReason(err, 'Could not update the trip'));
          this.busy.set(false);
        },
      });
      return;
    }
    const here = this.here();
    this.busy.set(true);
    this.api.setStatus(trip.id, status, here ? { lat: here.lat, lng: here.lng } : {}).subscribe({
      next: (updated) => {
        this.ride.set(updated.status === 'completed' ? null : updated);
        this.busy.set(false);
      },
      error: (err: { error?: { error?: { message?: string; code?: string } } }) => {
        this.error.set(failureReason(err, 'Could not update the trip'));
        this.busy.set(false);
      },
    });
  }

  confirmStop(trip: DriverRide): void {
    this.finish(trip, true);
  }

  keepGoing(): void {
    this.stopPrompt.set('');
  }

  private finish(trip: DriverRide, confirmStop: boolean): void {
    const here = this.here();
    this.busy.set(true);
    this.api.setStatus(trip.id, 'completed', { lat: here?.lat, lng: here?.lng, confirmStop }).subscribe({
      next: (updated) => {
        this.stopPrompt.set('');
        if (updated.status === 'completed') {
          this.ride.set(null);
          this.clearTrip();
          this.loadSummary();
        } else {
          this.ride.set(updated);
        }
        this.busy.set(false);
      },
      error: (err: { error?: { error?: { message?: string; code?: string } } }) => {
        const code = err.error?.error?.code;
        const message = err.error?.error?.message ?? 'Could not update the trip';
        if (code === 'CONFIRM_STOP') this.stopPrompt.set(message);
        else this.error.set(message);
        this.busy.set(false);
      },
    });
  }

  logout(): void {
    this.api.disconnect();
    this.session.clear();
    void this.router.navigateByUrl('/login');
  }

  private startShift(lat: number, lng: number): void {
    const name = this.session.user()?.fullName ?? 'Driver';
    this.busy.set(true);
    this.api
      .online({ lat, lng, fullName: name })
      .subscribe({
        next: (result) => {
          this.online.set(true);
          this.ride.set(result.activeRide);
          if (result.activeRide) this.drawTrip(result.activeRide);
          this.watch();
          this.loadSummary();
          this.busy.set(false);
        },
        error: (err: { error?: { error?: { message?: string } } }) => {
          this.error.set(failureReason(err, 'Could not go online'));
          this.busy.set(false);
        },
      });
  }

  private readGps(onFix: (lat: number, lng: number) => void, onFail?: (blocked: boolean) => void): void {
    if (!this.secure || !navigator.geolocation) {
      onFail?.(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.zone.run(() => onFix(pos.coords.latitude, pos.coords.longitude)),
      (err) => this.zone.run(() => onFail?.(err.code === err.PERMISSION_DENIED)),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
    );
  }

  private placeSelf(lat: number, lng: number): void {
    this.here.set({ lat, lng });
    this.selfMarker?.remove();
    this.selfMarker = L.circleMarker([lat, lng], {
      radius: 9,
      color: '#f5c542',
      fillColor: '#f5c542',
      fillOpacity: 1,
    }).addTo(this.map!);
    if (!this.ride()) this.map?.setView([lat, lng], Math.max(this.map.getZoom(), 14));
    if (this.online()) this.api.location(lat, lng).subscribe();
    this.error.set('');
  }

  private watch(): void {
    if (!this.secure || !navigator.geolocation) return;
    this.startPresence();
    if (this.watchId) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.zone.run(() => {
          this.placeSelf(pos.coords.latitude, pos.coords.longitude);
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  }

  private startPresence(): void {
    void this.holdAwake();
    if (this.pulse) return;
    document.addEventListener('visibilitychange', this.onVisible);
    this.pulse = setInterval(() => this.pushLocation(), 20000);
  }

  private stopPresence(): void {
    if (this.pulse) clearInterval(this.pulse);
    this.pulse = undefined;
    document.removeEventListener('visibilitychange', this.onVisible);
    const lock = this.wakeLock;
    this.wakeLock = null;
    void lock?.release().catch(() => undefined);
  }

  private pushLocation(): void {
    if (!this.online()) return;
    void this.holdAwake();
    this.readGps(
      (lat, lng) => this.placeSelf(lat, lng),
      () => {
        const point = this.here();
        if (point) this.api.location(point.lat, point.lng).subscribe({ error: () => undefined });
      },
    );
  }

  private async holdAwake(): Promise<void> {
    if (!this.online() || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    if (this.wakeLock && !this.wakeLock.released) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }

  private loadSummary(): void {
    this.api.summary().subscribe({
      next: (data) => {
        this.summary.set(data);
        if (data.isOnline) {
          this.online.set(true);
          this.watch();
        }
      },
    });
  }

  private clearTrip(): void {
    this.pickupMarker?.remove();
    this.dropoffMarker?.remove();
    this.routeLine?.remove();
    this.pickupMarker = undefined;
    this.dropoffMarker = undefined;
    this.routeLine = undefined;
    this.routeKey = '';
  }

  private drawTrip(trip: DriverRide): void {
    if (!this.map) return;
    const pickup = L.latLng(Number(trip.pickupLat), Number(trip.pickupLng));
    const dropoff = L.latLng(Number(trip.dropoffLat), Number(trip.dropoffLng));
    this.pickupMarker?.remove();
    this.dropoffMarker?.remove();
    this.pickupMarker = L.circleMarker(pickup, { radius: 8, color: '#3ddc97' }).addTo(this.map);
    this.dropoffMarker = L.circleMarker(dropoff, { radius: 8, color: '#6cb6ff' }).addTo(this.map);
    const leg = this.navLeg(trip);
    const from = L.latLng(leg.origin.lat, leg.origin.lng);
    const target = L.latLng(leg.destination.lat, leg.destination.lng);
    const key = `${trip.id}:${leg.kind}:${from.lat.toFixed(3)},${from.lng.toFixed(3)}`;
    this.map.fitBounds(L.latLngBounds([from, pickup, dropoff]), { padding: [40, 40], maxZoom: 15 });
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.api.route(from.lat, from.lng, target.lat, target.lng).subscribe({
      next: (coordinates) => {
        if (!this.map || this.routeKey !== key || coordinates.length < 2) return;
        this.routeLine?.remove();
        this.routeLine = L.polyline(coordinates, { color: '#3ddc97', weight: 5, opacity: 0.9 }).addTo(this.map);
        this.map.fitBounds(L.latLngBounds(coordinates), { padding: [40, 40], maxZoom: 15 });
      },
    });
  }
}
