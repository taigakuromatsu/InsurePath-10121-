import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from './services/auth.service';
import { CurrentOfficeService } from './services/current-office.service';
import { CurrentUserService } from './services/current-user.service';
import { UserRole } from './types';
import { DisplayNameEditDialogComponent } from './components/display-name-edit-dialog.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgFor,
    NgIf,
    AsyncPipe,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly navLinks: { label: string; path: string; icon: string; roles: UserRole[] }[] = [
    { label: 'ダッシュボード', path: '/dashboard', icon: 'dashboard', roles: ['admin', 'hr'] },
    { label: '事業所設定', path: '/offices', icon: 'apartment', roles: ['admin'] },
    { label: '保険料率管理', path: '/masters', icon: 'settings', roles: ['admin'] },
    { label: '従業員台帳', path: '/employees', icon: 'group', roles: ['admin', 'hr'] },
    { label: '月次保険料', path: '/premiums/monthly', icon: 'table_chart', roles: ['admin', 'hr'] },
    { label: '賞与保険料', path: '/premiums/bonus', icon: 'card_giftcard', roles: ['admin', 'hr'] },
    { label: '保険料納付状況管理', path: '/payments', icon: 'account_balance', roles: ['admin', 'hr'] },
    { label: '申請ワークフロー', path: '/requests', icon: 'assignment', roles: ['admin', 'hr'] },
    { label: '保険手続き状況管理', path: '/procedures', icon: 'assignment_turned_in', roles: ['admin', 'hr'] },
    { label: '扶養状況確認', path: '/dependent-reviews', icon: 'family_restroom', roles: ['admin', 'hr'] },
    { label: '書類管理', path: '/documents', icon: 'description', roles: ['admin', 'hr'] },
    // シュミレーター機能は一時的に非表示（コードは残す）
    // { label: 'シミュレーター', path: '/simulator', icon: 'calculate', roles: ['admin', 'hr'] },
    // マイページは employeeId の有無で判定（navLinks$ で特別処理）
    { label: 'マイページ', path: '/me', icon: 'person', roles: ['admin', 'hr', 'employee'] }
  ];

  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly isAuthenticated$ = this.authService.authState$.pipe(map((user) => Boolean(user)));
  readonly userProfile$ = this.currentUser.profile$;
  readonly office$ = this.currentOffice.office$;
  readonly navLinks$ = this.currentUser.profile$.pipe(
    map((profile) => {
      if (!profile) {
        return [] as typeof this.navLinks;
      }
      return this.navLinks.filter((link) => {
        // 「マイページ」は employeeId の有無で判定
        if (link.path === '/me') {
          return Boolean(profile.employeeId);
        }
        // その他のリンクは role で判定
        return link.roles.includes(profile.role);
      });
    })
  );

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }

  async openDisplayNameEditDialog(): Promise<void> {
    const currentProfile = await firstValueFrom(this.currentUser.profile$);
    if (!currentProfile) {
      return;
    }

    const dialogRef = this.dialog.open(DisplayNameEditDialogComponent, {
      width: '500px',
      data: {
        currentDisplayName: currentProfile.displayName
      }
    });

    dialogRef.afterClosed().subscribe(async (newDisplayName) => {
      if (newDisplayName && newDisplayName !== currentProfile.displayName) {
        await this.currentUser.updateDisplayName(newDisplayName);
      }
    });
  }
}
