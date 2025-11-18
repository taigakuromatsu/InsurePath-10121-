// src/app/services/current-user.service.ts

import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject, from, of, shareReplay, switchMap, map } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { UserProfile } from '../types';
import { AuthService } from './auth.service';


@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(null);
  readonly profile$ = this.profileSubject
    .asObservable()
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly hasOffice$ = this.profile$.pipe(map((profile) => Boolean(profile?.officeId)));
  readonly officeId$ = this.profile$.pipe(map((profile) => profile?.officeId ?? null));

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

          const ref = doc(this.firestore, 'users', user.uid);

          // 1) 必ず users/{uid} を作っておく（既にあれば update だけ）
          return from(this.authService.ensureUserDocument(user)).pipe(
            // 2) そのあとで Firestore から 1 回だけ最新プロファイルを取得
            switchMap(() => from(getDoc(ref))),
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

  async assignOffice(officeId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('ログイン情報を確認できませんでした');
    }

    const userDoc = doc(this.firestore, 'users', user.uid);
    const now = new Date().toISOString();
    const role = this.profileSubject.value?.role ?? 'admin';

    await setDoc(
      userDoc,
      {
        id: user.uid,
        officeId,
        role,
        displayName: user.displayName ?? user.email ?? 'User',
        email: user.email ?? 'unknown@example.com',
        updatedAt: now,
        createdAt: this.profileSubject.value?.createdAt ?? now,
      },
      { merge: true }
    );

    // ローカルキャッシュも更新しておくとガードが即反映される
    const current = this.profileSubject.value;
    if (current) {
      this.profileSubject.next({ ...current, officeId, updatedAt: now });
    }
  }

  async updateProfile(payload: Partial<UserProfile>): Promise<void> {
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
  }
}
