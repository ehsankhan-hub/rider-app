import { Component, inject, signal } from '@angular/core';
import { Ride, RideApiService } from '../../core/ride-api.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  template: `
    <section class="page">
      <h2>Your trips</h2>
      @for (ride of rides(); track ride.id) {
        <article class="card item">
          <div>
            <strong>{{ ride.status }}</strong>
            <p>{{ ride.pickupAddress }} → {{ ride.dropoffAddress }}</p>
            <small>{{ ride.paymentMethod }} · {{ ride.fareAmount }}</small>
          </div>
          @if (ride.status !== 'completed' && ride.status !== 'cancelled' && ride.status !== 'in_progress') {
            <button class="ghost" (click)="cancel(ride.id)">Cancel</button>
          }
        </article>
      } @empty {
        <p>No trips yet.</p>
      }
    </section>
  `,
  styles: [
    `
      .page { padding: 24px; display: grid; gap: 12px; overflow: auto; height: 100%; }
      .item { display: flex; justify-content: space-between; align-items: center; }
      p, small { color: var(--muted); }
    `,
  ],
})
export class TripsComponent {
  private readonly api = inject(RideApiService);
  rides = signal<Ride[]>([]);

  constructor() {
    this.reload();
  }

  cancel(id: string): void {
    this.api.cancel(id).subscribe(() => this.reload());
  }

  private reload(): void {
    this.api.listRides().subscribe((list) => this.rides.set(list));
  }
}
