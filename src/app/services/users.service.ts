import { Injectable } from '@angular/core';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { Observable, catchError, combineLatest, from, map, of } from 'rxjs';

import { UserProfile } from '../types';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly firestore: Firestore) {}

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
