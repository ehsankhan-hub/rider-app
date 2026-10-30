import { Injectable, signal } from '@angular/core';

export interface SessionUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const KEY = 'rider.customer.session';

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly user = signal<SessionUser | null>(null);
  private readonly listeners = new Set<() => void>();

  constructor() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSession;
      this.user.set(parsed.user);
    }
  }

  get accessToken(): string | null {
    return this.stored()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.stored()?.refreshToken ?? null;
  }

  private stored(): StoredSession | null {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }

  setSession(data: StoredSession): void {
    localStorage.setItem(KEY, JSON.stringify(data));
    this.user.set(data.user);
    this.emit();
  }

  clear(): void {
    localStorage.removeItem(KEY);
    this.user.set(null);
    this.emit();
  }

  listen(fn: () => void): void {
    this.listeners.add(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
