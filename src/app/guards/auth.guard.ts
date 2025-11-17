import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.authState$.pipe(
    take(1),
    map((user) => {
      if (user) {
        return true;
      }
      router.navigateByUrl('/login');
      return false;
    })
  );
};
