import { NgIf } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, firstValueFrom } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { CurrentUserService } from '../../services/current-user.service';
import { EmployeePortalInvitesService } from '../../services/employee-portal-invites.service';
import { EmployeesService } from '../../services/employees.service';
import { UserRole } from '../../types';

@Component({
  selector: 'ip-accept-invite-page',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, NgIf],
  template: `
    <section class="page accept-invite">
      <div class="container">
        <mat-card class="card">
          <div class="header">
            <div class="icon">
              <mat-icon>how_to_reg</mat-icon>
            </div>
            <div>
              <h1>従業員ポータル招待の確認</h1>
              <p class="subtitle">招待リンクを検証し、アカウントを従業員レコードに紐づけます。</p>
            </div>
          </div>

          <div class="body" *ngIf="loading(); else loaded">
            <div class="center">
              <mat-spinner diameter="48"></mat-spinner>
              <p class="muted">招待リンクを確認しています…</p>
            </div>
          </div>

          <ng-template #loaded>
            <div class="body" *ngIf="needsLogin(); else afterLogin">
              <div class="state state-warn">
                <mat-icon color="warn">login</mat-icon>
                <div>
                  <h2>ログインが必要です</h2>
                  <p class="muted">Googleでログインして招待を受け付けてください。</p>
                </div>
              </div>
              <div class="actions">
                <button mat-flat-button color="primary" (click)="goToLogin()">
                  <mat-icon>login</mat-icon>
                  Googleでログイン
                </button>
              </div>
            </div>
          </ng-template>

          <ng-template #afterLogin>
            <div class="body" *ngIf="errorMessage(); else successState">
              <div class="state state-warn">
                <mat-icon color="warn">error</mat-icon>
                <div>
                  <h2>招待を処理できませんでした</h2>
                  <p class="muted">{{ errorMessage() }}</p>
                  <p class="muted" *ngIf="inviteSummary()">招待先: {{ inviteSummary() }}</p>
                </div>
              </div>
              <div class="actions">
                <button mat-stroked-button color="primary" (click)="retry()" [disabled]="loading()">
                  再試行する
                </button>
                <button mat-flat-button color="primary" (click)="goToLogin()">
                  <mat-icon>switch_account</mat-icon>
                  別のアカウントでログイン
                </button>
              </div>
            </div>

            <ng-template #successState>
              <div class="body">
                <div class="state state-success">
                  <mat-icon color="primary">check_circle</mat-icon>
                  <div>
                    <h2>従業員ポータルへの接続が完了しました</h2>
                    <p class="muted">マイページへリダイレクトします…</p>
                  </div>
                </div>
                <div class="invite-info" *ngIf="inviteEmail()">
                  <span class="label">招待先メール</span>
                  <span class="value">{{ inviteEmail() }}</span>
                </div>
              </div>
            </ng-template>
          </ng-template>
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      .accept-invite {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 80vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 24px;
      }

      .container {
        width: 100%;
        max-width: 720px;
      }

      .card {
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
      }

      .header .icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        display: grid;
        place-items: center;
      }

      .header mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .header h1 {
        margin: 0 0 4px;
        font-size: 1.6rem;
        font-weight: 700;
      }

      .subtitle {
        margin: 0;
        color: rgba(255, 255, 255, 0.85);
      }

      .body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .center {
        display: grid;
        place-items: center;
        gap: 12px;
        padding: 16px 0;
      }

      .state {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px 0;
      }

      .state mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .state-success mat-icon {
        color: #3f51b5;
      }

      .state-warn mat-icon {
        color: #e53935;
      }

      .muted {
        color: #6b7280;
        margin: 4px 0 0;
      }

      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .invite-info {
        display: inline-flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fafafa;
        width: fit-content;
      }

      .invite-info .label {
        font-size: 0.85rem;
        color: #6b7280;
      }

      .invite-info .value {
        font-weight: 600;
        color: #111827;
      }

      @media (max-width: 640px) {
        .accept-invite {
          padding: 16px;
        }

        .header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class AcceptInvitePage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly invitesService = inject(EmployeePortalInvitesService);
  private readonly employeesService = inject(EmployeesService);
  private readonly currentUser = inject(CurrentUserService);

  readonly loading = signal(true);
  readonly needsLogin = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly inviteEmail = signal<string | null>(null);
  readonly inviteSummary = signal<string | null>(null);

  private readonly token = (this.route.snapshot.queryParamMap.get('token') ?? '').trim();
  private authSub?: Subscription;
  private processed = false;

  constructor() {
    if (!this.token) {
      this.loading.set(false);
      this.errorMessage.set('トークンが指定されていません。招待URLを確認してください。');
      return;
    }

    this.authSub = this.authService.authState$.subscribe((user) => {
      if (!user) {
        this.loading.set(false);
        this.needsLogin.set(true);
        return;
      }

      this.needsLogin.set(false);
      this.handleInvite(user.uid, user.email ?? null);
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  goToLogin(): void {
    const redirect = encodeURIComponent(this.router.url);
    this.router.navigateByUrl(`/login?mode=employee&redirect=${redirect}`);
  }

  async retry(): Promise<void> {
    if (this.loading()) {
      return;
    }
    const currentUser = await firstValueFrom(this.currentUser.profile$);
    const user = await firstValueFrom(this.authService.authState$);
    if (!user) {
      this.needsLogin.set(true);
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);
    this.processed = false;
    await this.handleInvite(user.uid, user.email ?? null, currentUser?.role);
  }

  private async handleInvite(uid: string, email: string | null, roleHint?: string | null): Promise<void> {
    if (this.processed) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const invite = await this.invitesService.getInviteOnce(this.token);
      if (!invite) {
        this.setError('この招待リンクは無効です。管理者に問い合わせてください。');
        return;
      }

      this.inviteEmail.set(invite.invitedEmail);
      this.inviteSummary.set(`${invite.invitedEmail} / office: ${invite.officeId}`);

      if (invite.used) {
        this.setError('この招待リンクは既に使用されています。管理者に再招待を依頼してください。');
        return;
      }

      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        this.setError('この招待リンクの有効期限が切れています。管理者に再招待を依頼してください。');
        return;
      }

      if (!email) {
        this.setError('ログイン中のアカウントにメールアドレスが設定されていません。管理者に問い合わせてください。');
        return;
      }

      const normalizedEmail = email.toLowerCase();
      if (invite.invitedEmail.toLowerCase() !== normalizedEmail) {
        this.setError(
          `招待されたメールアドレス（${invite.invitedEmail}）とログイン中のアカウント（${email}）が一致しません。正しいアカウントでログインしてください。`
        );
        return;
      }

      const employee = await firstValueFrom(
        this.employeesService.get(invite.officeId, invite.employeeId)
      );
      if (!employee) {
        this.setError('従業員情報が見つかりませんでした。管理者に問い合わせてください。');
        return;
      }

      if (employee.officeId !== invite.officeId) {
        this.setError('招待情報と従業員情報の事業所が一致しません。管理者に問い合わせてください。');
        return;
      }

      const profile = await firstValueFrom(this.currentUser.profile$);
      if (profile?.officeId && profile.officeId !== invite.officeId) {
        this.setError('別の事業所に紐づいたアカウントです。招待された事業所のアカウントでログインしてください。');
        return;
      }

      const now = new Date().toISOString();
      const nextRole = this.resolveRole(roleHint ?? profile?.role);
      await this.currentUser.updateProfile({
        officeId: profile?.officeId ?? invite.officeId,
        employeeId: invite.employeeId,
        role: nextRole
      });

      await this.employeesService.updatePortal(
        invite.officeId,
        invite.employeeId,
        {
          status: 'linked',
          invitedEmail: invite.invitedEmail,
          invitedAt: employee.portal?.invitedAt ?? invite.createdAt,
          linkedUserId: uid,
          linkedAt: now
        },
        uid
      );

      await this.invitesService.markAsUsed(this.token, uid);

      this.processed = true;
      this.loading.set(false);

      setTimeout(() => {
        this.router.navigateByUrl('/me');
      }, 2000);
    } catch (error: any) {
      console.error('[accept-invite] failed', error);
      this.setError('処理中にエラーが発生しました。ネットワークを確認して再度お試しください。');
    }
  }

  private setError(message: string): void {
    this.errorMessage.set(message);
    this.loading.set(false);
  }

  private resolveRole(role?: string | null): UserRole {
    if (role === 'admin' || role === 'hr' || role === 'employee') {
      return role;
    }
    return 'employee';
  }
}


