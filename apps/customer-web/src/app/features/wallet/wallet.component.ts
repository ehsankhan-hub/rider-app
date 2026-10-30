import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RideApiService } from '../../core/ride-api.service';

interface WalletView {
  wallet: { balance: string; currency: string };
  transactions: Array<{ id: string; type: string; amount: string; createdAt?: string }>;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <div class="card">
        <h2>Wallet</h2>
        <p class="bal">{{ data()?.wallet?.currency }} {{ data()?.wallet?.balance }}</p>
        <label>Top up amount <input type="number" [(ngModel)]="amount" /></label>
        <button (click)="topUp()">Add funds</button>
      </div>
      <div class="card">
        <h3>Ledger</h3>
        @for (tx of data()?.transactions ?? []; track tx.id) {
          <p>{{ tx.type }} · {{ tx.amount }}</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .page { padding: 24px; display: grid; gap: 16px; max-width: 560px; }
      .bal { font-size: 32px; margin: 8px 0 16px; }
    `,
  ],
})
export class WalletComponent {
  private readonly api = inject(RideApiService);
  data = signal<WalletView | null>(null);
  amount = 20;

  constructor() {
    this.reload();
  }

  topUp(): void {
    this.api.topUp(Number(this.amount)).subscribe(() => this.reload());
  }

  private reload(): void {
    this.api.wallet().subscribe((d) => this.data.set(d as WalletView));
  }
}
