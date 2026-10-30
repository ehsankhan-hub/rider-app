import { HttpBackend, HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { refreshAccess } from './session-keep-alive';
import { SessionService } from './session.service';

const RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const backend = inject(HttpBackend);
  const router = inject(Router);
  const token = session.accessToken;
  const send = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(send).pipe(
    catchError((err: unknown) => {
      if (
        req.context.get(RETRIED) ||
        !(err instanceof HttpErrorResponse) ||
        err.status !== 401 ||
        req.url.includes('/api/v1/auth/')
      ) {
        return throwError(() => err);
      }
      return refreshAccess(session, backend).pipe(
        switchMap((access) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${access}` }, context: req.context.set(RETRIED, true) })),
        ),
        catchError((refreshErr: unknown) => {
          if (refreshErr instanceof HttpErrorResponse && (refreshErr.status === 401 || refreshErr.status === 403)) {
            session.clear();
            void router.navigateByUrl('/login');
          }
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
