import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';

import { CurrentUserService } from '../services/current-user.service';
import type { UserProfile } from '../types';

export const officeGuard: CanActivateFn = () => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  return currentUser.profile$.pipe(
    // 最初に流れてくる null（ロード前）はスキップして、
    // 実際の UserProfile が読めるまで待つ
    filter((profile): profile is UserProfile => profile !== null),
    take(1),
    map((profile): boolean | UrlTree => {
      if (profile.officeId) {
        // 事業所に所属している → 通常遷移
        return true;
      }
      // 未所属 → オフィス設定ページへ誘導
      return router.createUrlTree(['/office-setup']);
    })
  );
};
