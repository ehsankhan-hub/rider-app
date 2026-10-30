import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../core/auth-api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <section class="card form">
        <h1>Create account</h1>
        <label>Full name <input [(ngModel)]="fullName" /></label>
        <label>Email <input [(ngModel)]="email" type="email" /></label>
        <label>Phone <input [(ngModel)]="phone" /></label>
        <label>Password <input [(ngModel)]="password" type="password" /></label>
        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
        <button (click)="submit()" [disabled]="busy()">Register</button>
        <a routerLink="/login">I already have an account</a>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
      .form { width: min(420px, 100%); display: grid; gap: 12px; }
      .err { color: var(--danger); }
      a { color: var(--accent); }
    `,
  ],
})
export class RegisterComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  fullName = '';
  email = '';
  phone = '';
  password = '';
  busy = signal(false);
  error = signal('');

  submit(): void {
    this.busy.set(true);
    this.error.set('');
    this.api
      .register({
        fullName: this.fullName,
        email: this.email,
        phone: this.phone,
        password: this.password,
      })
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (err: { error?: { error?: { message?: string } } }) => {
          this.error.set(err.error?.error?.message ?? 'Register failed');
          this.busy.set(false);
        },
      });
  }
}
