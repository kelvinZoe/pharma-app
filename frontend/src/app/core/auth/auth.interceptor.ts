import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { SessionService } from './session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // We only intercept requests to our backend API
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('localhost:3000');
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('pharma.token') : null;

  let authReq = req;
  if (isApiRequest && token) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Clear session on 401 Unauthorized
        sessionService.logout();
        router.navigateByUrl('/login');
      }
      return throwError(() => error);
    })
  );
};
