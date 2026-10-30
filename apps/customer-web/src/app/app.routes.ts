import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/booking/booking.component').then((m) => m.BookingComponent),
      },
      {
        path: 'trips',
        loadComponent: () =>
          import('./features/trips/trips.component').then((m) => m.TripsComponent),
      },
      {
        path: 'wallet',
        loadComponent: () =>
          import('./features/wallet/wallet.component').then((m) => m.WalletComponent),
      },
    ],
  },
];
