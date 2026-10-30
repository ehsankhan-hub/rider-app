import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../core/auth-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <section class="card form">
        <h1>Admin sign in</h1>
        <label>Username <input [(ngModel)]="email" type="text" autocomplete="username" /></label>
        <label>Password <input [(ngModel)]="password" type="password" /></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button (click)="submit()" [disabled]="busy()">Continue</button>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
      .form { width: min(420px, 100%); display: grid; gap: 12px; }
      h1 { margin: 0; }
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
      next: () => void this.router.navigateByUrl('/'),
      error: () => {
        this.error.set('Use an admin account');
        this.busy.set(false);
      },
    });
  }
}
