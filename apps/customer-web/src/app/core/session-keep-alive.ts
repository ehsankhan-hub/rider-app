import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, throwError } from 'rxjs';
import { env } from './env';
import { SessionService } from './session.service';

let inflight: Observable<string> | null = null;

export function refreshAccess(session: SessionService, backend: HttpBackend): Observable<string> {
  if (inflight) return inflight;
  const refreshToken = session.refreshToken;
  const user = session.user();
  if (!refreshToken || !user) return throwError(() => new Error('no session'));
  const http = new HttpClient(backend);
  inflight = http
    .post<{ data: { tokens: { accessToken: string; refreshToken: string } } }>(`${env.authApi}/api/v1/auth/refresh`, {
      refreshToken,
    })
    .pipe(
      map((res) => {
        session.setSession({
          accessToken: res.data.tokens.accessToken,
          refreshToken: res.data.tokens.refreshToken,
          user,
        });
        return res.data.tokens.accessToken;
      }),
      finalize(() => {
        inflight = null;
      }),
      shareReplay(1),
    );
  return inflight;
}

@Injectable({ providedIn: 'root' })
export class SessionKeepAlive {
  private readonly session = inject(SessionService);
  private readonly backend = inject(HttpBackend);
  private readonly router = inject(Router);
  private timer = 0;

  constructor() {
    this.session.listen(() => this.arm());
  }

  arm(): void {
    window.clearTimeout(this.timer);
    const token = this.session.accessToken;
    if (!token) return;
    const delay = Math.max(1_000, tokenExpiry(token) - Date.now() - 60_000);
    this.timer = window.setTimeout(() => {
      refreshAccess(this.session, this.backend).subscribe({
        error: (err: { status?: number }) => {
          if (err.status === 401 || err.status === 403) {
            this.session.clear();
            void this.router.navigateByUrl('/login');
            return;
          }
          this.timer = window.setTimeout(() => this.arm(), 15_000);
        },
      });
    }, delay);
  }
}

export function tokenExpiry(token: string): number {
  try {
    const body = token.split('.')[1] ?? '';
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 60_000;
  } catch {
    return Date.now() + 60_000;
  }
}
