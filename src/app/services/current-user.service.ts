// src/app/services/current-user.service.ts

import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Auth, updateProfile } from '@angular/fire/auth';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { BehaviorSubject, from, of, shareReplay, switchMap, map } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { UserProfile } from '../types';
import { AuthService } from './auth.service';


@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly injector = inject(EnvironmentInjector);
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(null);
  readonly profile$ = this.profileSubject
    .asObservable()
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly hasOffice$ = this.profile$.pipe(map((profile) => Boolean(profile?.officeId)));
  readonly officeId$ = this.profile$.pipe(map((profile) => profile?.officeId ?? null));

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  constructor(
    private readonly auth: Auth,
    private readonly firestore: Firestore,
    private readonly authService: AuthService
  ) {
    this.authService.authState$
      .pipe(
        switchMap((user) => {
          if (!user) {
            // ログアウト時はプロファイルをクリア
            return of(null);
          }

          // 1) 必ず users/{uid} を作っておく（既にあれば update だけ）
          return from(this.authService.ensureUserDocument(user)).pipe(
            // 2) そのあとで Firestore から 1 回だけ最新プロファイルを取得
            switchMap(() => from(this.inCtx(() => {
              const ref = doc(this.firestore, 'users', user.uid);
              return getDoc(ref);
            }))),
            map((snapshot) => {
              if (!snapshot.exists()) {
                // ここに来ることはほぼない想定だが、安全のため null を返す
                return null;
              }
              const data = snapshot.data() as UserProfile;
              return { ...data, id: snapshot.id };
            }),
            // 3) どこかでエラーしてもストリームが死なないように
            catchError((err) => {
              console.error('ユーザープロフィールの取得に失敗しました', err);
              return of(null);
            })
          );
        })
      )
      .subscribe((profile) => {
        this.profileSubject.next(profile);
      });
  }

  /**
   * メールアドレスで従業員レコードを検索し、employeeId を取得する
   *
   * @param officeId - 事業所ID
   * @param email - 検索対象のメールアドレス（小文字に正規化して検索）
   * @returns 従業員ID（見つからない場合は null）
   */
  private async findEmployeeIdByEmail(officeId: string, email: string): Promise<string | null> {
    if (!officeId || !email) {
      return null;
    }

    return this.inCtxAsync(async () => {
    try {
      const employeesRef = collection(this.firestore, 'offices', officeId, 'employees');
      const q = query(employeesRef, where('contactEmail', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0]?.id ?? null;
    } catch (error) {
      console.error('従業員レコードの検索に失敗しました', error);
      return null;
    }
    });
  }

  async assignOffice(officeId: string, skipEmployeeSearch: boolean = false): Promise<void> {
    return this.inCtxAsync(async () => {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('ログイン情報を確認できませんでした');
    }

    const userDoc = doc(this.firestore, 'users', user.uid);
    const now = new Date().toISOString();
    const role = this.profileSubject.value?.role ?? 'employee';

    let employeeId = this.profileSubject.value?.employeeId;
    if (!employeeId && user.email && !skipEmployeeSearch) {
      employeeId = (await this.findEmployeeIdByEmail(officeId, user.email)) ?? undefined;
    }

    const updateData: Record<string, unknown> = {
      id: user.uid,
      officeId,
      role,
      displayName: user.displayName ?? user.email ?? 'User',
      email: user.email ?? 'unknown@example.com',
      updatedAt: now,
      createdAt: this.profileSubject.value?.createdAt ?? now,
    };

    if (employeeId) {
      updateData['employeeId'] = employeeId;
    }

    await setDoc(userDoc, updateData, { merge: true });

    // ローカルキャッシュも更新しておくとガードが即反映される
    const current = this.profileSubject.value;
    if (current) {
      this.profileSubject.next({
        ...current,
        officeId,
        ...(employeeId && { employeeId }),
        updatedAt: now,
      });
    }
    });
  }

  async updateProfile(payload: Partial<UserProfile>): Promise<void> {
    return this.inCtxAsync(async () => {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('ログイン情報を確認できませんでした');
    }

    const userDoc = doc(this.firestore, 'users', user.uid);
    const updatedAt = new Date().toISOString();

    await updateDoc(userDoc, { ...payload, updatedAt });

    const current = this.profileSubject.value;
    if (current) {
      this.profileSubject.next({ ...current, ...payload, updatedAt });
    }
    });
  }

  /**
   * ディスプレイネームを更新（Firebase AuthとFirestoreの両方を更新）
   */
  async updateDisplayName(newDisplayName: string): Promise<void> {
    return this.inCtxAsync(async () => {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('ログイン情報を確認できませんでした');
      }

      // Firebase Authのプロファイルを更新
      await updateProfile(user, { displayName: newDisplayName });

      // Firestoreのusersコレクションも更新
      const userDoc = doc(this.firestore, 'users', user.uid);
      const updatedAt = new Date().toISOString();
      await updateDoc(userDoc, { displayName: newDisplayName, updatedAt });

      // ローカルキャッシュも更新
      const current = this.profileSubject.value;
      if (current) {
        this.profileSubject.next({ ...current, displayName: newDisplayName, updatedAt });
    }
    });
  }
}
