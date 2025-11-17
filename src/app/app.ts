import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgFor,
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
}
