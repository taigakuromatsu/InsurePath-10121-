import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';

import { CurrentUserService } from '../services/current-user.service';
import { UserRole, UserProfile } from '../types';

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
      // 最初に流れてくる null（ロード前）はスキップして、
      // 実際の UserProfile が読めるまで待つ（officeGuard と同じパターン）
      filter((profile): profile is UserProfile => profile !== null),
      take(1),
      map((profile) => {
        if (!allowedRoles.includes(profile.role)) {
          router.navigateByUrl('/me');
          return false;
        }

        return true;
      })
    );
  };
};
