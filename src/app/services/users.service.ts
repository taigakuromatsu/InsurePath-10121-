import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable, catchError, combineLatest, from, map, of } from 'rxjs';

import { UserProfile, UserRole } from '../types';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly firestore: Firestore) {}

  /**
   * 指定した事業所に所属するユーザー一覧を取得
   */
  async getUsersByOfficeId(officeId: string): Promise<UserProfile[]> {
    if (!officeId) {
      return [];
    }

    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('officeId', '==', officeId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (docSnapshot) =>
        ({
          ...docSnapshot.data(),
          id: docSnapshot.id
        } as UserProfile)
    );
  }

  /**
   * ユーザーのロールを更新（admin のみ実行想定）
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const userDoc = doc(this.firestore, 'users', userId);
    const updatedAt = new Date().toISOString();

    await updateDoc(userDoc, {
      role: newRole,
      updatedAt
    });
  }

  private getUserDisplayName(userId: string): Observable<string | null> {
    const ref = doc(this.firestore, 'users', userId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        const data = snapshot.data() as UserProfile;
        return data.displayName ?? null;
      }),
      catchError(() => of(null))
    );
  }

  getUserDisplayNames(userIds: string[]): Observable<Map<string, string>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return of(new Map<string, string>());
    }

    const requests = uniqueIds.map((id) =>
      this.getUserDisplayName(id).pipe(map((name) => ({ id, name })))
    );

    return combineLatest(requests).pipe(
      map((results) => {
        const mapResult = new Map<string, string>();
        results.forEach(({ id, name }) => {
          if (name) {
            mapResult.set(id, name);
          }
        });
        return mapResult;
      })
    );
  }
}
