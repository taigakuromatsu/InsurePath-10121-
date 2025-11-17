import { Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { UserProfile } from '../types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly authState$: Observable<User | null> = authState(this.auth);

  constructor(private readonly auth: Auth, private readonly firestore: Firestore) {}

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);
    await this.ensureUserDocument(credential.user);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  async ensureUserDocument(user: User): Promise<void> {
    const userDoc = doc(this.firestore, 'users', user.uid);
    const snapshot = await getDoc(userDoc);

    const baseProfile: UserProfile = {
      id: user.uid,
      officeId: snapshot.exists() ? (snapshot.data()['officeId'] as string | undefined) : undefined,
      role: (snapshot.exists() ? snapshot.data()['role'] : 'admin') as UserProfile['role'],
      displayName: user.displayName ?? user.email ?? 'User',
      email: user.email ?? 'unknown@example.com',
      createdAt: snapshot.exists() ? snapshot.data()['createdAt'] : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (snapshot.exists()) {
      await updateDoc(userDoc, {
        displayName: baseProfile.displayName,
        email: baseProfile.email,
        updatedAt: baseProfile.updatedAt
      });
      return;
    }

    await setDoc(userDoc, baseProfile);
  }
}
