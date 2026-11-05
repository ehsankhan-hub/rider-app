import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, inject, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { AdminApiService, OperationsBoard } from '../core/admin-api.service';

type DriverRow = OperationsBoard['drivers'][number];

const STALE_MS = 3 * 60 * 1000;


@Component({
  selector: 'app-monitor',
  standalone: true,
  template: `
    <section class="card stack">
      <div>
        <h2>Driver monitor</h2>
        <p class="hint">Each marker is the phone’s last location. A red row means the driver is still online, but the phone has stopped reporting.</p>
      </div>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <div class="layout">
        <div class="map" #mapHost></div>
        <div class="list">
          @for (driver of ordered(); track driver.id) {
            <button type="button" class="person" [class.on]="selectedId() === driver.id" [class.stale]="stale(driver)" (click)="choose(driver)">
              <span class="dot" [attr.data-tone]="tone(driver)"></span>
              <span>
                <strong>{{ driver.fullName }}</strong>
                <em>{{ driver.vehicleName || 'No vehicle' }} · {{ driver.countryName || 'Country not set' }}</em>
                <em>{{ activity(driver) }}</em>
                <em>{{ freshness(driver) }}</em>
              </span>
            </button>
          } @empty {
            <p class="hint">No drivers yet.</p>
          }
        </div>
      </div>
      @if (selected(); as driver) {
        <article class="detail">
          <h3>{{ driver.fullName }}</h3>
          <p>{{ activity(driver) }}</p>
          <p class="hint">{{ freshness(driver) }} · {{ driver.lat.toFixed(5) }}, {{ driver.lng.toFixed(5) }}</p>
          @if (driver.trip; as trip) {
            <p><b>Pickup.</b> {{ trip.pickupAddress }}</p>
            <p><b>Drop-off.</b> {{ trip.dropoffAddress }}</p>
            <p class="hint">{{ gap(driver) }}</p>
          }
        </article>
      }
    </section>
  `,
  styles: [
    `
      .stack { display: grid; gap: 14px; }
      h2, h3, p { margin: 0; }
      .hint { color: var(--muted); }
      .layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr); gap: 12px; min-height: 520px; }
      .map { min-height: 520px; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
      .list { display: grid; align-content: start; gap: 8px; max-height: 520px; overflow: auto; }
      .person {
        display: flex;
        gap: 10px;
        text-align: start;
        background: #12181f;
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px;
      }
      .person.on { box-shadow: inset 0 0 0 2px var(--accent); }
      .person.stale { box-shadow: inset 0 0 0 2px var(--danger); }
      .person span { display: grid; gap: 2px; min-width: 0; }
      .person em { font-style: normal; color: var(--muted); font-size: 13px; }
      .dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; flex: 0 0 auto; background: #6b7785; }
      .dot[data-tone='free'] { background: #3ddc97; }
      .dot[data-tone='trip'] { background: #f0c14b; }
      .dot[data-tone='stale'] { background: #ff6b6b; }
      .detail { display: grid; gap: 6px; border-top: 1px solid var(--line); padding-top: 12px; }
      :host ::ng-deep .car-pin { background: transparent; border: 0; }
      @media (max-width: 800px) {
        .layout { grid-template-columns: 1fr; }
        .map, .list { max-height: 360px; min-height: 360px; }
      }
    `,
  ],
})
export class MonitorComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(AdminApiService);
  private readonly zone = inject(NgZone);
  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private map?: L.Map;
  private markers = new Map<string, L.Marker>();
  private tripLine?: L.Polyline;
  private tripStops: L.CircleMarker[] = [];
  private poll?: ReturnType<typeof setInterval>;
  private framed = false;

  readonly board = signal<OperationsBoard | null>(null);
  readonly error = signal('');
  readonly selectedId = signal('');

  ngAfterViewInit(): void {
    const host = this.mapHost().nativeElement;
    this.map = L.map(host, { zoomControl: true }).setView([26.42, 50.09], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);
    setTimeout(() => this.map?.invalidateSize(), 50);
    this.load();
    this.poll = setInterval(() => this.load(), 8000);
  }

  ngOnDestroy(): void {
    clearInterval(this.poll);
    this.map?.remove();
  }

  ordered(): DriverRow[] {
    return [...(this.board()?.drivers ?? [])].sort((a, b) => {
      const rank = this.rank(a) - this.rank(b);
      return rank || a.fullName.localeCompare(b.fullName);
    });
  }

  selected(): DriverRow | null {
    return this.board()?.drivers.find((driver) => driver.id === this.selectedId()) ?? null;
  }

  stale(driver: DriverRow): boolean {
    if (!driver.isOnline || !driver.lastSeenAt) return false;
    return Date.now() - new Date(driver.lastSeenAt).getTime() > STALE_MS;
  }

  tone(driver: DriverRow): string {
    if (!driver.isOnline) return 'off';
    if (this.stale(driver)) return 'stale';
    if (driver.onTrip) return 'trip';
    return 'free';
  }

  activity(driver: DriverRow): string {
    if (!driver.isOnline) return 'Offline';
    const trip = driver.trip;
    if (!trip) return driver.isAvailable ? 'Free, waiting for a ride' : 'Online';
    if (trip.status === 'assigned') return 'Accepted a ride';
    if (trip.status === 'arriving') return 'Waiting at the pickup';
    if (trip.status === 'in_progress') return 'On the trip';
    return 'On a ride';
  }

  freshness(driver: DriverRow): string {
    if (!driver.lastSeenAt) return 'No location yet';
    const minutes = Math.max(0, Math.round((Date.now() - new Date(driver.lastSeenAt).getTime()) / 60000));
    const when = minutes < 1 ? 'just now' : minutes === 1 ? '1 min ago' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
    if (driver.isOnline && this.stale(driver)) return `Phone stopped reporting ${when}`;
    return `Last location ${when}`;
  }

  gap(driver: DriverRow): string {
    const trip = driver.trip;
    if (!trip) return '';
    if (trip.status === 'in_progress') {
      return `${this.km(driver.lat, driver.lng, trip.dropoffLat, trip.dropoffLng)} km from the drop-off`;
    }
    return `${this.km(driver.lat, driver.lng, trip.pickupLat, trip.pickupLng)} km from the pickup`;
  }

  choose(driver: DriverRow): void {
    this.selectedId.set(driver.id);
    this.map?.setView([driver.lat, driver.lng], Math.max(this.map.getZoom(), 14));
    this.paint();
  }

  private load(): void {
    const today = this.board()?.date ?? new Date().toISOString().slice(0, 10);
    this.api.operations(today).subscribe({
      next: (board) => {
        this.board.set(board);
        this.error.set('');
        this.paint();
      },
      error: () => this.error.set('Could not load driver locations'),
    });
  }

  private paint(): void {
    const map = this.map;
    const drivers = this.board()?.drivers ?? [];
    if (!map) return;
    const spots = this.spread(drivers.filter((driver) => Number.isFinite(driver.lat) && Number.isFinite(driver.lng)));
    const seen = new Set<string>();
    for (const driver of drivers) {
      const at = spots.get(driver.id);
      if (!at) continue;
      seen.add(driver.id);
      const icon = this.pin(driver);
      const existing = this.markers.get(driver.id);
      if (existing) {
        existing.setLatLng(at);
        existing.setIcon(icon);
      } else {
        const marker = L.marker(at, { icon, zIndexOffset: driver.isOnline ? 400 : 0 }).addTo(map);
        marker.on('click', () => this.zone.run(() => this.choose(driver)));
        this.markers.set(driver.id, marker);
      }
    }
    for (const [id, marker] of this.markers) {
      if (seen.has(id)) continue;
      marker.remove();
      this.markers.delete(id);
    }
    this.paintTrip();
    if (!this.framed && seen.size > 0) {
      const bounds = L.latLngBounds([...spots.values()]);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
      this.framed = true;
    }
  }

  private paintTrip(): void {
    this.tripLine?.remove();
    this.tripLine = undefined;
    for (const stop of this.tripStops) stop.remove();
    this.tripStops = [];
    const map = this.map;
    const driver = this.selected();
    const trip = driver?.trip;
    if (!map || !driver || !trip) return;
    const pickup = L.latLng(trip.pickupLat, trip.pickupLng);
    const dropoff = L.latLng(trip.dropoffLat, trip.dropoffLng);
    this.tripStops = [
      L.circleMarker(pickup, { radius: 7, color: '#3ddc97', fillColor: '#3ddc97', fillOpacity: 1 }).addTo(map),
      L.circleMarker(dropoff, { radius: 7, color: '#6cb6ff', fillColor: '#6cb6ff', fillOpacity: 1 }).addTo(map),
    ];
    this.tripLine = L.polyline([[driver.lat, driver.lng], trip.status === 'in_progress' ? dropoff : pickup], {
      color: '#f0c14b',
      weight: 4,
    }).addTo(map);
  }

  private spread(drivers: DriverRow[]): Map<string, L.LatLng> {
    const placed = new Map<string, L.LatLng>();
    const groups = new Map<string, DriverRow[]>();
    for (const driver of drivers) {
      const key = `${driver.lat.toFixed(3)},${driver.lng.toFixed(3)}`;
      const list = groups.get(key) ?? [];
      list.push(driver);
      groups.set(key, list);
    }
    for (const group of groups.values()) {
      group.forEach((driver, index) => {
        const real = L.latLng(driver.lat, driver.lng);
        if (!this.map || group.length < 2) {
          placed.set(driver.id, real);
          return;
        }
        const angle = (2 * Math.PI * index) / group.length - Math.PI / 2;
        const origin = this.map.project(real, this.map.getZoom());
        placed.set(driver.id, this.map.unproject(origin.add([Math.cos(angle) * 22, Math.sin(angle) * 22]), this.map.getZoom()));
      });
    }
    return placed;
  }

  private pin(driver: DriverRow): L.DivIcon {
    const color = this.tone(driver) === 'stale' ? '#ff6b6b' : this.tone(driver) === 'trip' ? '#f0c14b' : driver.isOnline ? '#3ddc97' : '#6b7785';
    const letter = driver.fullName.slice(0, 1).toUpperCase();
    return L.divIcon({
      className: 'car-pin',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#102017;display:grid;place-items:center;font:700 13px sans-serif;border:2px solid #fff">${letter}</div>`,
    });
  }

  private rank(driver: DriverRow): number {
    if (driver.isOnline && this.stale(driver)) return 0;
    if (driver.onTrip) return 1;
    if (driver.isOnline) return 2;
    return 3;
  }

  private km(lat: number, lng: number, otherLat: number, otherLng: number): string {
    const earth = 6371;
    const dLat = ((otherLat - lat) * Math.PI) / 180;
    const dLng = ((otherLng - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((otherLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return (2 * earth * Math.asin(Math.min(1, Math.sqrt(a)))).toFixed(1);
  }
}
