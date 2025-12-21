import { NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { EmployeePortalInvitesService } from '../../services/employee-portal-invites.service';
import { Employee } from '../../types';

export interface InviteEmployeeDialogData {
  employee: Employee;
  officeId: string;
}

export interface InviteEmployeeDialogResult {
  invited: boolean;
}

@Component({
  selector: 'ip-invite-employee-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>従業員ポータル招待</h1>
    <div mat-dialog-content class="content">
      <p class="muted">従業員 <strong>{{ data.employee.name }}</strong> さんにポータル招待を発行します。</p>

      <div *ngIf="loading(); else inviteContent" class="center">
        <mat-spinner diameter="32"></mat-spinner>
        <p class="muted">招待URLを生成しています…</p>
      </div>

      <ng-template #inviteContent>
        <div *ngIf="error(); else inviteReady" class="error">
          <mat-icon color="warn">error</mat-icon>
          <div>
            <p class="muted">{{ error() }}</p>
            <p class="muted" *ngIf="!data.employee.contactEmail">
              従業員のメールアドレス（contactEmail）が未登録です。登録してから再度お試しください。
            </p>
          </div>
        </div>
      </ng-template>

      <ng-template #inviteReady>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>招待URL</mat-label>
          <input matInput [value]="inviteUrl()" readonly />
        </mat-form-field>
        <p class="muted">
          このURLを従業員に共有してください。リンクは7日間有効です。
        </p>
      </ng-template>
    </div>

    <div mat-dialog-actions align="end" class="actions">
      <button mat-button (click)="close()">閉じる</button>
      <button
        mat-flat-button
        color="primary"
        (click)="copy()"
        [disabled]="!inviteUrl() || loading() || !!error()"
      >
        <mat-icon>content_copy</mat-icon>
        URLをコピー
      </button>
    </div>
  `,
  styles: [
    `
      .content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 320px;
      }

      .muted {
        color: #6b7280;
        margin: 0;
      }

      .full-width {
        width: 100%;
      }

      .center {
        display: grid;
        place-items: center;
        gap: 8px;
        padding: 12px 0;
      }

      .error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: #c62828;
      }

      .actions {
        gap: 8px;
      }
    `
  ]
})
export class InviteEmployeeDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<InviteEmployeeDialogComponent, InviteEmployeeDialogResult>>(MatDialogRef);
  private readonly invitesService = inject(EmployeePortalInvitesService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data = inject<InviteEmployeeDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly inviteUrl = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.createInvite();
  }

  private async createInvite(): Promise<void> {
    const email = this.data.employee.contactEmail;
    if (!email) {
      this.loading.set(false);
      this.error.set('メールアドレスが登録されていないため招待を発行できません。');
      return;
    }

    try {
      const invite = await this.invitesService.createInvite(
        this.data.officeId,
        this.data.employee.id,
        email
      );
      const baseUrl = window.location.origin;
      this.inviteUrl.set(`${baseUrl}/employee-portal/accept-invite?token=${invite.id}`);
    } catch (err) {
      this.error.set('招待URLの生成に失敗しました。しばらくしてから再度お試しください。');
    } finally {
      this.loading.set(false);
    }
  }

  async copy(): Promise<void> {
    const url = this.inviteUrl();
    if (!url) return;

    await navigator.clipboard.writeText(url);
    this.snackBar.open('URLをコピーしました', '閉じる', { duration: 3000 });
    this.dialogRef.close({ invited: true });
  }

  close(): void {
    this.dialogRef.close({ invited: Boolean(this.inviteUrl()) });
  }
}


