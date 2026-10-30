import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth.component').then((m) => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth.component').then((m) => m.RegisterComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shift.component').then((m) => m.ShiftComponent),
  },
];
