import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SystemRole } from '../models/enums';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  if (!token) {
    return router.createUrlTree(['/login']);
  }

  const payload = authService.decodeToken(token);
  if (!payload) {
    return router.createUrlTree(['/login']);
  }

  const requiredRole = route.data['role'] as SystemRole | undefined;
  if (!requiredRole || payload.role === requiredRole) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
