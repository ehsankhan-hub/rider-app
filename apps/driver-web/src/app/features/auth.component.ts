import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthApiService } from '../core/auth-api.service';
import { DriverApiService, VehicleType } from '../core/driver-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <section class="card form">
        <h1>Driver sign in</h1>
        <label>Email <input [(ngModel)]="email" type="email" /></label>
        <label>Password <input [(ngModel)]="password" type="password" /></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button (click)="submit()" [disabled]="busy()">Continue</button>
        <a routerLink="/register">Create a driver account</a>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
      .form { width: min(420px, 100%); display: grid; gap: 12px; }
      h1 { margin: 0; }
      a { color: var(--accent); }
      .err { color: var(--danger); }
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
      error: () => {
        this.error.set('Use a driver account');
        this.busy.set(false);
      },
    });
  }
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <section class="card form">
        <h1>Become a driver</h1>
        <label>Full name <input [(ngModel)]="fullName" /></label>
        <label>Email <input [(ngModel)]="email" type="email" /></label>
        <label>Phone <input [(ngModel)]="phone" /></label>
        <label>Password <input [(ngModel)]="password" type="password" /></label>
        <label>
          Vehicle
          <select [(ngModel)]="vehicleTypeId">
            @for (v of vehicles(); track v.id) {
              <option [value]="v.id">{{ v.displayName }}</option>
            }
          </select>
        </label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button (click)="submit()" [disabled]="busy()">Create account</button>
        <a routerLink="/login">Already have an account</a>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
      .form { width: min(420px, 100%); display: grid; gap: 12px; }
      h1 { margin: 0; }
      a { color: var(--accent); }
      .err { color: var(--danger); }
    `,
  ],
})
export class RegisterComponent {
  private readonly api = inject(AuthApiService);
  private readonly rides = inject(DriverApiService);
  private readonly router = inject(Router);
  fullName = '';
  email = '';
  phone = '';
  password = '';
  vehicleTypeId = '';
  vehicles = signal<VehicleType[]>([]);
  busy = signal(false);
  error = signal('');

  constructor() {
    this.rides.vehicleTypes().subscribe({
      next: (list) => {
        this.vehicles.set(list);
        const economy = list.find((item) => item.code === 'economy');
        this.vehicleTypeId = (economy ?? list[0])?.id ?? '';
      },
      error: () => this.error.set('Could not load vehicle types'),
    });
  }

  submit(): void {
    if (!this.vehicleTypeId) {
      this.error.set('Choose a vehicle type');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .register({ email: this.email, password: this.password, phone: this.phone, fullName: this.fullName })
      .pipe(switchMap(() => this.rides.registerVehicle({ vehicleTypeId: this.vehicleTypeId, fullName: this.fullName })))
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (err: { error?: { error?: { message?: string } } }) => {
          this.error.set(err.error?.error?.message ?? 'Could not register');
          this.busy.set(false);
        },
      });
  }
}
