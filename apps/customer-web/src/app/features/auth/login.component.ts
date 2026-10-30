import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../core/auth-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <section class="card form">
        <h1>Welcome back</h1>
        <p>Sign in to book a ride.</p>
        <label>Email <input [(ngModel)]="email" type="email" /></label>
        <label>Password <input [(ngModel)]="password" type="password" /></label>
        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
        <button (click)="submit()" [disabled]="busy()">Continue</button>
        <a routerLink="/register">Create an account</a>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
      .form { width: min(420px, 100%); display: grid; gap: 12px; }
      h1 { margin: 0; }
      p { color: var(--muted); }
      .err { color: var(--danger); }
      a { color: var(--accent); }
    `,
  ],
})
export class LoginComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  email = '';
  password = '';
  busy = signal(false);
  error = signal('');

  submit(): void {
    this.busy.set(true);
    this.error.set('');
    this.api.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err: { error?: { error?: { message?: string } } }) => {
        this.error.set(err.error?.error?.message ?? 'Login failed');
        this.busy.set(false);
      },
    });
  }
}
