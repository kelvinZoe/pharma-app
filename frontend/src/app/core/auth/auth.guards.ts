import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ModuleKey, SessionService } from './session.service';

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const session = inject(SessionService);

  if (!session.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(session.getDefaultRoute(session.currentUser()!.role));
};

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const session = inject(SessionService);

  if (session.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};

export function moduleAccessGuard(moduleKey: ModuleKey): CanActivateFn {
  return () => {
    const router = inject(Router);
    const session = inject(SessionService);
    const user = session.currentUser();

    if (!user) {
      return router.parseUrl('/login');
    }

    if (session.canAccessModule(moduleKey)) {
      return true;
    }

    return router.parseUrl(session.getDefaultRoute(user.role));
  };
}
