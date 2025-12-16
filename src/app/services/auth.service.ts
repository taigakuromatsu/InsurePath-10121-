import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { UserProfile } from '../types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly injector = inject(EnvironmentInjector);
  readonly authState$: Observable<User | null>;

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxP<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  constructor(private readonly auth: Auth, private readonly firestore: Firestore) {
    this.authState$ = authState(this.auth);
  }

  async signInWithGoogle(): Promise<void> {
    await this.inCtxP(async () => {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(this.auth, provider);
      await this.ensureUserDocument(credential.user);
    });
  }
  
  async signInWithEmailAndPassword(email: string, password: string): Promise<void> {
    await this.inCtxP(async () => {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      await this.ensureUserDocument(credential.user);
    });
  }
  
  async signUpWithEmailAndPassword(email: string, password: string, displayName?: string): Promise<void> {
    await this.inCtxP(async () => {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      if (displayName) await updateProfile(credential.user, { displayName });
      await this.ensureUserDocument(credential.user);
    });
  }
  
  signOut(): Promise<void> {
    return this.inCtxP(() => signOut(this.auth));
  }
  

  async ensureUserDocument(user: User): Promise<void> {
    const userDoc = this.inCtx(() => doc(this.firestore, 'users', user.uid));
    const snapshot = await this.inCtxP(() => getDoc(userDoc));

    const baseProfile: UserProfile = {
      id: user.uid,
      officeId: snapshot.exists()
        ? (snapshot.data()['officeId'] as string | undefined)
        : undefined,
      role: (snapshot.exists() ? snapshot.data()['role'] : 'employee') as UserProfile['role'],
      displayName: user.displayName ?? user.email ?? 'User',
      email: user.email ?? 'unknown@example.com',
      createdAt: snapshot.exists()
        ? snapshot.data()['createdAt']
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (snapshot.exists()) {
      await this.inCtxP(() => updateDoc(userDoc, {
        displayName: baseProfile.displayName,
        email: baseProfile.email,
        updatedAt: baseProfile.updatedAt
      }));
      return;
    }

    // ★ここだけ変更★
    // Firestore は undefined を受け付けないので、officeId が undefined なら削除してから保存する
    const dataToSave: any = { ...baseProfile };
    if (dataToSave.officeId === undefined) {
      delete dataToSave.officeId;
    }
    if (dataToSave.employeeId === undefined) {
      delete dataToSave.employeeId;
    }

    await this.inCtxP(() => setDoc(userDoc, dataToSave));
  }
}
