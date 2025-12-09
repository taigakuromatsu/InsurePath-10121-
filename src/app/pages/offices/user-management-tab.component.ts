import { NgIf } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { CurrentOfficeService } from '../../services/current-office.service';
import { CurrentUserService } from '../../services/current-user.service';
import { UsersService } from '../../services/users.service';
import { UserProfile, UserRole } from '../../types';

@Component({
  selector: 'ip-user-management-tab',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    NgIf
  ],
  template: `
    <mat-card class="user-management-card">
      <div class="card-header">
        <div class="title">
          <mat-icon color="primary">manage_accounts</mat-icon>
          <div>
            <h3>ユーザー管理</h3>
            <p class="muted">事業所に属するユーザーのロールを確認・編集します（管理者のみ編集可能）。</p>
          </div>
        </div>
        <div class="actions">
          <button mat-stroked-button color="primary" (click)="reload()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            再読み込み
          </button>
        </div>
      </div>

      <div class="body" *ngIf="officeId(); else noOffice">
        <div class="loading" *ngIf="loading(); else tableTpl">
          <mat-progress-spinner diameter="32" mode="indeterminate"></mat-progress-spinner>
          <span>読み込み中…</span>
        </div>

        <ng-template #tableTpl>
          <mat-table [dataSource]="users()">
            <ng-container matColumnDef="displayName">
              <mat-header-cell *matHeaderCellDef>表示名</mat-header-cell>
              <mat-cell *matCellDef="let user">{{ user.displayName }}</mat-cell>
            </ng-container>

            <ng-container matColumnDef="email">
              <mat-header-cell *matHeaderCellDef>メール</mat-header-cell>
              <mat-cell *matCellDef="let user">{{ user.email }}</mat-cell>
            </ng-container>

            <ng-container matColumnDef="role">
              <mat-header-cell *matHeaderCellDef>ロール</mat-header-cell>
              <mat-cell *matCellDef="let user">
                <mat-select
                  [value]="user.role"
                  [disabled]="!canEditRole() || updating()"
                  (selectionChange)="updateRole(user.id, $event.value)"
                >
                  <mat-option value="admin">管理者</mat-option>
                  <mat-option value="hr">人事担当者</mat-option>
                  <mat-option value="employee">一般従業員</mat-option>
                </mat-select>
              </mat-cell>
            </ng-container>

            <ng-container matColumnDef="employeeId">
              <mat-header-cell *matHeaderCellDef>従業員ID</mat-header-cell>
              <mat-cell *matCellDef="let user">{{ user.employeeId || '-' }}</mat-cell>
            </ng-container>

            <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
            <mat-row *matRowDef="let row; columns: displayedColumns"></mat-row>
          </mat-table>

          <p class="muted note" *ngIf="!users().length">該当するユーザーが見つかりません。</p>
        </ng-template>
      </div>

      <ng-template #noOffice>
        <div class="state state-warn">
          <mat-icon color="warn">warning</mat-icon>
          <div>
            <p class="m-0">事業所情報が取得できませんでした。</p>
            <p class="muted m-0">再読み込みするか、別のユーザーでログインしてください。</p>
          </div>
        </div>
      </ng-template>
    </mat-card>
  `,
  styles: [
    `
      .user-management-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .title h3 {
        margin: 0 0 4px;
      }

      .title .muted {
        margin: 0;
        color: #6b7280;
      }

      .actions {
        display: flex;
        gap: 0.5rem;
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .loading {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        color: #6b7280;
      }

      .state {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 0.75rem 0;
      }

      .muted {
        color: #6b7280;
      }

      .note {
        margin-top: 0.5rem;
      }

      mat-header-cell,
      mat-cell {
        padding-right: 12px;
      }

      mat-select {
        min-width: 180px;
      }
    `
  ]
})
export class UserManagementTabComponent implements OnDestroy {
  private readonly usersService = inject(UsersService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly snackBar = inject(MatSnackBar);

  readonly users = signal<UserProfile[]>([]);
  readonly loading = signal(false);
  readonly updating = signal(false);
  readonly officeId = signal<string | null>(null);
  readonly displayedColumns = ['displayName', 'email', 'role', 'employeeId'];

  private readonly profile = toSignal(this.currentUser.profile$, { initialValue: null });
  private readonly officeSub: Subscription;

  constructor() {
    this.officeSub = this.currentOffice.officeId$.subscribe((officeId) => {
      this.officeId.set(officeId);
      if (officeId) {
        this.loadUsers(officeId);
      } else {
        this.users.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.officeSub.unsubscribe();
  }

  canEditRole(): boolean {
    return this.profile()?.role === 'admin';
  }

  async reload(): Promise<void> {
    const officeId = this.officeId();
    if (!officeId) {
      return;
    }
    await this.loadUsers(officeId);
  }

  private async loadUsers(officeId: string): Promise<void> {
    this.loading.set(true);
    try {
      const users = await this.usersService.getUsersByOfficeId(officeId);
      this.users.set(users);
    } catch (error) {
      console.error(error);
      this.snackBar.open('ユーザー一覧の取得に失敗しました', '閉じる', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async updateRole(userId: string, newRole: UserRole): Promise<void> {
    if (!this.canEditRole()) {
      this.snackBar.open('ロールを変更できるのは管理者のみです', '閉じる', { duration: 2500 });
      return;
    }
    const selfId = this.profile()?.id;
    if (selfId && userId === selfId && newRole !== this.profile()?.role) {
      this.snackBar.open('自分自身のロールはこの画面から変更できません', '閉じる', { duration: 3000 });
      return;
    }
    const officeId = this.officeId();
    if (!officeId) {
      this.snackBar.open('事業所情報が取得できませんでした', '閉じる', { duration: 3000 });
      return;
    }

    this.updating.set(true);
    try {
      await this.usersService.updateUserRole(userId, newRole);
      this.snackBar.open('ロールを更新しました', '閉じる', { duration: 3000 });
      await this.loadUsers(officeId);
    } catch (error) {
      console.error(error);
      this.snackBar.open('ロールの更新に失敗しました', '閉じる', { duration: 3000 });
      await this.loadUsers(officeId);
    } finally {
      this.updating.set(false);
    }
  }
}

