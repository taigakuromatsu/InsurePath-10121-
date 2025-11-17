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
  readonly navLinks = [
    { label: 'ダッシュボード', path: '/dashboard', icon: 'dashboard' },
    { label: '事業所設定', path: '/offices', icon: 'apartment' },
    { label: '従業員台帳', path: '/employees', icon: 'group' },
    { label: '月次保険料', path: '/premiums/monthly', icon: 'table_chart' },
    { label: '賞与保険料', path: '/premiums/bonus', icon: 'card_giftcard' },
    { label: 'マスタ管理', path: '/masters', icon: 'settings' },
    { label: '申請ワークフロー', path: '/requests', icon: 'assignment' },
    { label: 'シミュレーター', path: '/simulator', icon: 'calculate' },
    { label: 'マイページ', path: '/me', icon: 'person' }
  ] as const;

  private readonly authService = inject(AuthService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly currentOffice = inject(CurrentOfficeService);
  private readonly router = inject(Router);

  readonly isAuthenticated$ = this.authService.authState$.pipe(map((user) => Boolean(user)));
  readonly userProfile$ = this.currentUser.profile$;
  readonly office$ = this.currentOffice.office$;

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
