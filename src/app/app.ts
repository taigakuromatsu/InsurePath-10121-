import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { map } from 'rxjs/operators';

import { AuthService } from './services/auth.service';
import { CurrentOfficeService } from './services/current-office.service';
import { CurrentUserService } from './services/current-user.service';
import { UserRole } from './types';

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
    MatButtonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly navLinks: { label: string; path: string; icon: string; roles: UserRole[] }[] = [
    { label: 'ダッシュボード', path: '/dashboard', icon: 'dashboard', roles: ['admin', 'hr'] },
    { label: '事業所設定', path: '/offices', icon: 'apartment', roles: ['admin'] },
    { label: '従業員台帳', path: '/employees', icon: 'group', roles: ['admin', 'hr'] },
    { label: '月次保険料', path: '/premiums/monthly', icon: 'table_chart', roles: ['admin', 'hr'] },
    { label: '賞与保険料', path: '/premiums/bonus', icon: 'card_giftcard', roles: ['admin', 'hr'] },
    { label: '社会保険料納付状況', path: '/payments', icon: 'account_balance', roles: ['admin', 'hr'] },
    { label: '保険料率管理', path: '/masters', icon: 'settings', roles: ['admin'] },
    { label: '申請ワークフロー', path: '/requests', icon: 'assignment', roles: ['admin', 'hr'] },
    { label: '社会保険手続き状況', path: '/procedures', icon: 'assignment_turned_in', roles: ['admin', 'hr'] },
    { label: '扶養状況確認', path: '/dependent-reviews', icon: 'family_restroom', roles: ['admin', 'hr'] },
    { label: '書類管理', path: '/documents', icon: 'description', roles: ['admin', 'hr'] },
    { label: 'シミュレーター', path: '/simulator', icon: 'calculate', roles: ['admin', 'hr'] },
    { label: 'マイページ', path: '/me', icon: 'person', roles: ['admin', 'hr', 'employee'] }
  ];

  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly router = inject(Router);

  readonly isAuthenticated$ = this.authService.authState$.pipe(map((user) => Boolean(user)));
  readonly userProfile$ = this.currentUser.profile$;
  readonly office$ = this.currentOffice.office$;
  readonly navLinks$ = this.currentUser.profile$.pipe(
    map((profile) => {
      if (!profile) {
        return [] as typeof this.navLinks;
      }
      return this.navLinks.filter((link) => link.roles.includes(profile.role));
    })
  );

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
