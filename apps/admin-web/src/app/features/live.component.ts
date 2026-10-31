import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, OperationsBoard } from '../core/admin-api.service';

type BoardRide = OperationsBoard['rides'][number];

@Component({
  selector: 'app-live',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="card stack">
      <div class="row">
        <div>
          <h2>Live cars</h2>
          <p class="hint">
            Counts use {{ board()?.city }} time ({{ board()?.timezone }}). A driver is live only after Go online.
          </p>
        </div>
        <label>Day <input type="date" [ngModel]="day" (ngModelChange)="changeDay($event)" /></label>
      </div>
      @if (error()) { <p class="err">{{ error() }}</p> }
      @if (board(); as view) {
        <div class="stats">
          <article><b>{{ view.live.online }}</b><span>Online</span></article>
          <article><b>{{ view.live.free }}</b><span>Free</span></article>
          <article><b>{{ view.live.onTrip }}</b><span>On a trip</span></article>
          <article><b>{{ view.window.completed }}</b><span>Completed</span></article>
          <article><b>{{ view.window.cancelled }}</b><span>Cancelled</span></article>
          <article><b>{{ view.currency }} {{ view.window.fareAmount }}</b><span>Completed fare</span></article>
        </div>
        <h3>By vehicle</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th class="num">Online</th>
                <th class="num">Free</th>
                <th class="num">On a trip</th>
                <th class="num">Completed</th>
                <th class="num">Fare</th>
              </tr>
            </thead>
            <tbody>
              @for (row of view.byVehicle; track row.code) {
                <tr>
                  <td class="strong">{{ row.name }}</td>
                  <td class="num">{{ row.online }}</td>
                  <td class="num">{{ row.free }}</td>
                  <td class="num">{{ row.onTrip }}</td>
                  <td class="num">{{ row.completed }}</td>
                  <td class="num">{{ view.currency }} {{ row.fareAmount }}</td>
                </tr>
              } @empty {
                <tr><td class="empty" colspan="6">No vehicles yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <h3>Drivers by country</h3>
        @for (group of grouped(view.drivers); track group.country) {
          <h4>{{ group.country }} <span class="count">{{ group.rows.length }}</span></h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Vehicle</th><th>Status</th><th>Online since</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                @for (driver of group.rows; track driver.id) {
                  <tr>
                    <td class="strong">{{ driver.fullName }}</td>
                    <td>{{ driver.vehicleName }}</td>
                    <td><span class="pill" [attr.data-tone]="driverTone(driver)">{{ status(driver) }}</span></td>
                    <td class="muted">{{ when(driver.onlineSince, view.timezone) }}</td>
                    <td class="muted">{{ when(driver.lastSeenAt, view.timezone) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @empty {
          <p class="hint">No registered drivers yet.</p>
        }
        <h3>Customers by country</h3>
        <p class="hint">A customer’s country is where their phone last was, or the pickup of their latest trip.</p>
        @for (group of grouped(view.customers); track group.country) {
          <h4>{{ group.country }} <span class="count">{{ group.rows.length }}</span></h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th></tr>
              </thead>
              <tbody>
                @for (customer of group.rows; track customer.id) {
                  <tr><td class="strong">{{ customer.fullName }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        } @empty {
          <p class="hint">No customers yet. A name appears after someone opens the app or books a ride.</p>
        }
        <h3>Trips this day</h3>
        <p class="hint">Open trips stay at the top. A trip marked Needs review did not reach the drop-off. Open Review to compare the quote with where the car stopped and how long it ran. Accept the fare if the rider got out there. Mark it fake if the trip did not happen — that fare is then left out of driver earnings.</p>
        <div class="table-wrap">
          <table class="wide">
            <thead>
              <tr><th>When</th><th>Status</th><th>Vehicle</th><th>Driver</th><th>Route</th><th class="num">Fare</th><th></th></tr>
            </thead>
            <tbody>
              @for (ride of view.rides; track ride.id) {
                <tr>
                  <td class="muted nowrap">{{ when(ride.createdAt, view.timezone) }}</td>
                  <td>
                    <span class="pill" [attr.data-tone]="rideTone(ride.status)">{{ ride.status }}</span>
                    @if (ride.reviewStatus === 'accepted') {
                      <span class="pill" data-tone="free">Accepted</span>
                    } @else if (ride.reviewStatus === 'rejected') {
                      <span class="pill" data-tone="bad">Fake</span>
                    } @else if (ride.endNote === 'ended_early') {
                      <span class="pill" data-tone="trip">Ended early</span>
                    } @else if (ride.endNote === 'needs_review') {
                      <span class="pill" data-tone="bad">Needs review</span>
                    }
                  </td>
                  <td>{{ ride.vehicleName }}</td>
                  <td>{{ ride.driverName || '—' }}</td>
                  <td class="route">{{ ride.pickupAddress }} → {{ ride.dropoffAddress }}</td>
                  <td class="num">
                    {{ view.currency }} {{ ride.fareAmount }}
                    @if (ride.reviewStatus === 'rejected') { <span class="muted">not counted</span> }
                  </td>
                  <td class="action">
                    @if (flagged(ride)) {
                      <button type="button" class="ghost" (click)="toggleReview(ride.id)">{{ reviewId() === ride.id ? 'Hide' : 'Review' }}</button>
                    }
                    @if (open(ride.status)) {
                      <button type="button" class="ghost" (click)="cancel(ride.id)">Cancel</button>
                    }
                  </td>
                </tr>
                @if (reviewId() === ride.id) {
                  <tr class="detail">
                    <td colspan="7">
                      <p>{{ ride.reviewHint }}</p>
                      <div class="facts">
                        <div><span>Quoted</span><strong>{{ money(view.currency, ride.quoteFareAmount) }} · {{ ride.quoteDistanceKm || '—' }} km · {{ ride.quoteDurationMin || '—' }} min</strong></div>
                        <div><span>Charged</span><strong>{{ view.currency }} {{ ride.fareAmount }} · {{ ride.distanceKm }} km · {{ ride.durationMin }} min · {{ ride.paymentMethod === 'WALLET' ? 'Wallet' : 'Cash' }}</strong></div>
                        <div><span>Stop</span><strong>{{ ride.stopFromPickupKm ?? '—' }} km from pickup · {{ ride.stopFromDropoffKm ?? '—' }} km from drop-off</strong></div>
                      </div>
                      <ol>
                        @for (event of ride.events; track event.status + event.createdAt + event.note) {
                          <li><span>{{ when(event.createdAt, view.timezone) }}</span> {{ event.status }}@if (event.note) { — {{ event.note }} }</li>
                        }
                      </ol>
                      @if (!ride.reviewStatus) {
                        <div class="decide">
                          <button type="button" (click)="review(ride.id, 'accepted')" [disabled]="busy()">Accept fare</button>
                          <button type="button" class="ghost" (click)="review(ride.id, 'rejected')" [disabled]="busy()">Mark fake</button>
                        </div>
                        <p class="hint">Accept keeps this fare in driver earnings. Mark fake leaves it out. A wallet trip is refunded. Cash already handed to the driver is not taken back automatically.</p>
                      } @else if (ride.reviewStatus === 'accepted') {
                        <p class="hint">Accepted. This fare counts in driver earnings.</p>
                      } @else {
                        <p class="hint">Marked fake. This fare is left out of driver earnings.</p>
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td class="empty" colspan="7">No trips in this window.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .stack { display: grid; gap: 14px; }
      .row { display: flex; justify-content: space-between; gap: 12px; align-items: end; flex-wrap: wrap; }
      h2, h3, p { margin: 0; }
      .hint { color: var(--muted); }
      label { display: grid; gap: 6px; min-width: 180px; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      article { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: grid; gap: 4px; }
      article span { color: var(--muted); font-size: 13px; }
      h3 { margin-top: 6px; font-size: 15px; letter-spacing: 0.01em; }
      .table-wrap {
        overflow: auto;
        border: 1px solid #3a4a5c;
        border-radius: 14px;
        background: #12181f;
      }
      table { width: 100%; border-collapse: separate; border-spacing: 0; }
      table.wide { min-width: 760px; }
      thead th {
        position: sticky;
        top: 0;
        background: #2b3a4b;
        color: #e7eef6;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: left;
        padding: 12px 14px;
        border-bottom: 2px solid #4c6278;
        white-space: nowrap;
      }
      tbody td {
        padding: 13px 14px;
        border-bottom: 1px solid #2a3542;
        vertical-align: middle;
        background: #161d26;
      }
      tbody tr:nth-child(even) td { background: #1b242e; }
      tbody tr:last-child td { border-bottom: 0; }
      tbody tr:hover td { background: #243244; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      h4 { margin: 8px 0 0; font-size: 15px; display: flex; align-items: center; gap: 8px; }
      .count { color: var(--muted); font-size: 12px; font-weight: 650; }
      .strong { font-weight: 650; }
      .muted { color: var(--muted); }
      .nowrap { white-space: nowrap; }
      .route { min-width: 220px; line-height: 1.35; }
      .empty { text-align: center; color: var(--muted); padding: 22px 14px; }
      .action { width: 1%; white-space: nowrap; }
      .pill + .pill { margin-left: 6px; }
      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.01em;
        text-transform: capitalize;
        background: rgba(154, 168, 184, 0.16);
        color: #d5deea;
      }
      .pill[data-tone='free'] { background: rgba(61, 220, 151, 0.18); color: #8cf3c4; }
      .pill[data-tone='trip'] { background: rgba(255, 196, 87, 0.18); color: #ffd27a; }
      .pill[data-tone='off'] { background: rgba(154, 168, 184, 0.14); color: #b7c3d0; }
      .pill[data-tone='bad'] { background: rgba(255, 107, 107, 0.18); color: #ffb0b0; }
      .pill[data-tone='open'] { background: rgba(120, 170, 255, 0.18); color: #c5d8ff; }
      .detail td { background: #101820 !important; }
      .detail p { margin: 0 0 10px; line-height: 1.45; }
      .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px; }
      .facts div { display: grid; gap: 4px; }
      .facts span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
      ol { margin: 0 0 12px; padding-left: 18px; display: grid; gap: 4px; }
      ol span { color: var(--muted); }
      .decide { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    `,
  ],
})
export class LiveComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);
  private timer = 0;
  board = signal<OperationsBoard | null>(null);
  error = signal('');
  day = '';
  reviewId = signal('');
  busy = signal(false);

  ngOnInit(): void {
    this.load();
    this.timer = window.setInterval(() => this.load(), 15000);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timer);
  }

  changeDay(value: string): void {
    this.day = value;
    this.load();
  }

  open(status: string): boolean {
    return !['completed', 'cancelled'].includes(status);
  }

  cancel(id: string): void {
    this.api.cancelRide(id).subscribe({
      next: () => this.load(),
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(err.error?.error?.message ?? 'Could not cancel that trip');
      },
    });
  }

  flagged(ride: BoardRide): boolean {
    return ride.endNote === 'needs_review' || ride.endNote === 'ended_early';
  }

  toggleReview(id: string): void {
    this.reviewId.set(this.reviewId() === id ? '' : id);
    this.error.set('');
  }

  review(id: string, decision: 'accepted' | 'rejected'): void {
    this.busy.set(true);
    this.api.reviewRide(id, decision).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.busy.set(false);
        this.error.set(err.error?.error?.message ?? 'Could not save the review');
      },
    });
  }

  money(currency: string, amount: string | null): string {
    return amount ? `${currency} ${amount}` : '—';
  }

  driverTone(driver: OperationsBoard['drivers'][number]): string {
    if (!driver.isOnline) return 'off';
    if (driver.onTrip) return 'trip';
    if (driver.isAvailable) return 'free';
    return 'open';
  }

  rideTone(status: string): string {
    if (status === 'completed') return 'free';
    if (status === 'cancelled') return 'bad';
    if (status === 'in_progress' || status === 'arriving') return 'trip';
    return 'open';
  }

  grouped<T extends { countryName: string | null }>(rows: T[]): Array<{ country: string; rows: T[] }> {
    const buckets = new Map<string, T[]>();
    for (const row of rows) {
      const country = row.countryName || 'Country not set';
      const list = buckets.get(country) ?? [];
      list.push(row);
      buckets.set(country, list);
    }
    return [...buckets.entries()]
      .sort((a, b) => (a[0] === 'Country not set' ? 1 : b[0] === 'Country not set' ? -1 : a[0].localeCompare(b[0])))
      .map(([country, group]) => ({ country, rows: group }));
  }

  status(driver: OperationsBoard['drivers'][number]): string {
    if (!driver.isOnline) return 'Offline';
    if (driver.onTrip) return 'On a trip';
    if (driver.isAvailable) return 'Free';
    return 'Online';
  }

  when(value: string | null, timeZone: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private load(): void {
    this.api.operations(this.day).subscribe({
      next: (board) => {
        this.board.set(board);
        if (!this.day) this.day = board.date;
        this.error.set('');
      },
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(err.error?.error?.message ?? 'Could not load the live board');
      },
    });
  }
}
