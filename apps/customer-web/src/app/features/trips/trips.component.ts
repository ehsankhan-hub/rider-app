import { Component, inject, signal } from '@angular/core';
import { Ride, RideApiService } from '../../core/ride-api.service';

const STATUS: Record<string, string> = {
  requested: 'Requested',
  searching: 'Looking for a driver',
  offered: 'Looking for a driver',
  assigned: 'Driver on the way',
  arriving: 'Driver arrived',
  in_progress: 'On trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

@Component({
  selector: 'app-trips',
  standalone: true,
  template: `
    <section class="page">
      <h2>Your trips</h2>
      @for (ride of rides(); track ride.id) {
        <article class="card item">
          <div>
            <strong>{{ label(ride) }}</strong>
            <p>{{ ride.pickupAddress }}</p>
            <p class="to">{{ ride.dropoffAddress }}</p>
            <small>{{ when(ride) }} · {{ ride.paymentMethod === 'WALLET' ? 'Wallet' : 'Cash' }} · {{ ride.vehicleType?.displayName }}</small>
          </div>
          <div class="side">
            <b>{{ fare(ride) }}</b>
            @if (ride.status === 'requested' || ride.status === 'searching') {
              <button class="ghost" (click)="cancel(ride.id)">Cancel</button>
            }
          </div>
        </article>
      } @empty {
        <p>No trips yet.</p>
      }
    </section>
  `,
  styles: [
    `
      .page { padding: 24px; display: grid; gap: 12px; overflow: auto; height: 100%; align-content: start; }
      .item { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
      p, small { color: var(--muted); margin: 2px 0; }
      .to::before { content: '→ '; }
      .side { display: grid; justify-items: end; gap: 8px; }
    `,
  ],
})
export class TripsComponent {
  private readonly api = inject(RideApiService);
  rides = signal<Ride[]>([]);

  constructor() {
    this.reload();
  }

  label(ride: Ride): string {
    if (ride.status === 'cancelled' && ride.endNote === 'no_driver') return 'No driver found';
    if (ride.status === 'cancelled' && ride.endNote === 'no_show') return 'Driver left — no charge';
    return STATUS[ride.status] ?? ride.status;
  }

  fare(ride: Ride): string {
    const amount = Number(ride.fareAmount);
    return Number.isFinite(amount) ? amount.toFixed(2) : ride.fareAmount;
  }

  when(ride: Ride): string {
    if (!ride.createdAt) return '';
    const at = new Date(ride.createdAt);
    if (Number.isNaN(at.getTime())) return '';
    return at.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  cancel(id: string): void {
    this.api.cancel(id).subscribe(() => this.reload());
  }

  private reload(): void {
    this.api.listRides().subscribe((list) => this.rides.set(list));
  }
}
