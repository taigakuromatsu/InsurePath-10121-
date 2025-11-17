import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { CurrentUserService } from '../services/current-user.service';

export const needsOfficeGuard: CanActivateFn = () => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  return currentUser.profile$.pipe(
    take(1),
    map((profile) => {
      if (!profile?.officeId) {
        return true;
      }
      router.navigateByUrl('/dashboard');
      return false;
    })
  );
};
