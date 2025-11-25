import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { CurrentUserService } from '../services/current-user.service';
import { UserRole } from '../types';

/**
 * 指定されたロールのいずれかを持っているユーザーのみアクセスを許可するガード
 *
 * @param allowedRoles - アクセスを許可するロールの配列
 * @returns CanActivateFn
 */
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const currentUser = inject(CurrentUserService);

    return currentUser.profile$.pipe(
      take(1),
      map((profile) => {
        if (!profile) {
          router.navigateByUrl('/login');
          return false;
        }

        if (!allowedRoles.includes(profile.role)) {
          router.navigateByUrl('/me');
          return false;
        }

        return true;
      })
    );
  };
};
