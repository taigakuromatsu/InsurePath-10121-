import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docSnapshots, Firestore, setDoc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject, map, of, shareReplay, switchMap } from 'rxjs';

import { UserProfile } from '../types';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(null);
  readonly profile$ = this.profileSubject.asObservable().pipe(shareReplay({ bufferSize: 1, refCount: true }));

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
            return of(null);
          }
          const ref = doc(this.firestore, 'users', user.uid);
          return docSnapshots(ref as any).pipe(
            map((snapshot) => {
              if (!snapshot.exists()) {
                return null;
              }
              const data = snapshot.data() as UserProfile;
              return { ...data, id: snapshot.id };
            })
          );
        })
      )
      .subscribe((profile) => this.profileSubject.next(profile));
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
        createdAt: this.profileSubject.value?.createdAt ?? now
      },
      { merge: true }
    );
  }

  async updateProfile(payload: Partial<UserProfile>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('ログイン情報を確認できませんでした');
    }

    const userDoc = doc(this.firestore, 'users', user.uid);
    await updateDoc(userDoc, { ...payload, updatedAt: new Date().toISOString() });
  }
}
