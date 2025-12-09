import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';

import { CurrentUserService } from '../services/current-user.service';
import { UserProfile } from '../types';

/**
 * employeeId が設定されているユーザーのみアクセスを許可するガード
 * マイページ（/me）のアクセス制御に使用
 *
 * @returns CanActivateFn
 */
export const hasEmployeeIdGuard: CanActivateFn = () => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  return currentUser.profile$.pipe(
    // 最初に流れてくる null（ロード前）はスキップして、
    // 実際の UserProfile が読めるまで待つ
    filter((profile): profile is UserProfile => profile !== null),
    take(1),
    map((profile) => {
      if (!profile.employeeId) {
        // employeeId が無い場合は、ロールに応じて適切なページにリダイレクト
        if (profile.role === 'admin' || profile.role === 'hr') {
          // admin/hr の場合は dashboard にリダイレクト
          router.navigateByUrl('/dashboard');
        } else {
          // employee ロールで employeeId がない場合は、従業員登録が完了していない想定なので
          // ログイン画面にリダイレクトしてアクセスを拒否する
          router.navigateByUrl('/login');
        }
        return false;
      }

      return true;
    })
  );
};

