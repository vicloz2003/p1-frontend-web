import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return authService.refresh().pipe(
          switchMap(() => {
            const token = authService.getToken();
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
          }),
          catchError(refreshError => {
            authService.clearSession();
            return throwError(() => refreshError);
          })
        );
      }

      if (error.status === 403) {
        router.navigate(['/unauthorized']);
      }

      if (error.status === 500) {
        snackBar.open('A server error occurred. Please try again later.', 'Close', {
          duration: 5000,
        });
      }

      return throwError(() => error);
    })
  );
};
