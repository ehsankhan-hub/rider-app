import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { env } from './env';
import { SessionService, SessionUser } from './session.service';

interface AuthResponse {
  data: {
    user: SessionUser;
    tokens: { accessToken: string; refreshToken: string };
  };
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly session: SessionService,
  ) {}

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${env.authApi}/api/v1/auth/login`, { email, password })
      .pipe(map((res) => this.persist(res)));
  }

  register(payload: { email: string; password: string; phone: string; fullName: string }) {
    return this.http
      .post<AuthResponse>(`${env.authApi}/api/v1/auth/register`, payload)
      .pipe(map((res) => this.persist(res)));
  }

  private persist(res: AuthResponse) {
    this.session.setSession({
      accessToken: res.data.tokens.accessToken,
      refreshToken: res.data.tokens.refreshToken,
      user: res.data.user,
    });
    return res.data.user;
  }
}
