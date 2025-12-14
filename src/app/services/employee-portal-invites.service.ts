import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { firstValueFrom, from, map, Observable } from 'rxjs';

import { EmployeePortalInvite } from '../types';
import { EmployeesService } from './employees.service';

@Injectable({ providedIn: 'root' })
export class EmployeePortalInvitesService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(
    private readonly firestore: Firestore,
    private readonly auth: Auth,
    private readonly employeesService: EmployeesService
  ) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private inviteRef(token: string) {
    return this.inCtx(() => doc(this.firestore, 'employeePortalInvites', token));
  }

  private generateToken(length = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }

    return result;
  }

  async createInvite(
    officeId: string,
    employeeId: string,
    invitedEmail: string
  ): Promise<EmployeePortalInvite> {
    return this.inCtxAsync(async () => {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('認証情報を確認できませんでした。再度ログインしてください。');
      }

      const normalizedEmail = invitedEmail.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('招待先メールアドレスが設定されていません。');
      }

      const token = this.generateToken();
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const invite: EmployeePortalInvite = {
        id: token,
        officeId,
        employeeId,
        invitedEmail: normalizedEmail,
        createdByUserId: user.uid,
        createdAt,
        expiresAt,
        used: false
      };

      const ref = this.inviteRef(token);
      await setDoc(ref, invite);

      await this.employeesService.updatePortal(
        officeId,
        employeeId,
        {
          status: 'invited',
          invitedEmail: normalizedEmail,
          invitedAt: createdAt
        },
        user.uid
      );

      return invite;
    });
  }

  getInvite(token: string): Observable<EmployeePortalInvite | null> {
    return this.inCtx(() => {
      const ref = this.inviteRef(token);
      return from(getDoc(ref)).pipe(
        map((snapshot) => {
          if (!snapshot.exists()) {
            return null;
          }
          const data = snapshot.data() as EmployeePortalInvite;
          return { ...data, id: snapshot.id };
        })
      );
    });
  }

  getInviteOnce(token: string): Promise<EmployeePortalInvite | null> {
    return firstValueFrom(this.getInvite(token));
  }

  async markAsUsed(token: string, userId: string): Promise<void> {
    return this.inCtxAsync(async () => {
      const ref = this.inviteRef(token);
      const now = new Date().toISOString();
      await updateDoc(ref, {
        used: true,
        usedAt: now,
        usedByUserId: userId
      });
    });
  }
}


