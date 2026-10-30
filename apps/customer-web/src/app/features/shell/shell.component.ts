import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <header>
        <strong>RIDER</strong>
        <nav>
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Book</a>
          <a routerLink="/trips" routerLinkActive="on">Trips</a>
          <a routerLink="/wallet" routerLinkActive="on">Wallet</a>
        </nav>
        <span>{{ session.user()?.fullName }}</span>
        <button class="ghost" (click)="logout()">Sign out</button>
      </header>
      <main><router-outlet /></main>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .shell { height: 100%; display: grid; grid-template-rows: auto 1fr; }
      header {
        display: flex; align-items: center; gap: 16px;
        padding: 12px 20px; border-bottom: 1px solid var(--line);
      }
      nav { display: flex; gap: 12px; flex: 1; }
      a { color: var(--muted); text-decoration: none; }
      a.on { color: var(--accent); }
      main { min-height: 0; overflow: hidden; }
    `,
  ],
})
export class ShellComponent {
  readonly session = inject(SessionService);
  private readonly router = inject(Router);

  logout(): void {
    this.session.clear();
    void this.router.navigateByUrl('/login');
  }
}
