import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ip-dashboard-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `
    <section class="page dashboard">
      <mat-card class="header-card">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>dashboard</mat-icon>
          </div>
          <div class="header-text">
            <h1>ダッシュボード</h1>
            <p>事業所全体の社会保険料負担や直近トレンドを集約して可視化します。</p>
          </div>
        </div>
      </mat-card>

      <div class="dashboard-grid">
        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #e3f2fd;">
            <mat-icon style="color: #1976d2;">people</mat-icon>
          </div>
          <div class="stat-content">
            <h3>従業員数</h3>
            <p class="stat-value">-</p>
            <p class="stat-label">登録済み従業員</p>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #e8f5e9;">
            <mat-icon style="color: #2e7d32;">account_balance_wallet</mat-icon>
          </div>
          <div class="stat-content">
            <h3>月次保険料</h3>
            <p class="stat-value">-</p>
            <p class="stat-label">今月の会社負担額</p>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon" style="background: #fff3e0;">
            <mat-icon style="color: #e65100;">trending_up</mat-icon>
          </div>
          <div class="stat-content">
            <h3>トレンド</h3>
            <p class="stat-value">-</p>
            <p class="stat-label">前月比の変化</p>
          </div>
        </mat-card>

        <mat-card class="info-card">
          <h3>
            <mat-icon>info</mat-icon>
            今後の予定
          </h3>
          <p>
            将来的には KPI ウィジェットや最新アクティビティをここで確認できるようになります。
            グラフやチャートによる可視化機能も追加予定です。
          </p>
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      .header-card {
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .header-card ::ng-deep .mat-mdc-card-content {
        padding: 0;
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
      }

      .header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .header-icon mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: white;
      }

      .header-text h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.75rem;
        font-weight: 600;
      }

      .header-text p {
        margin: 0;
        opacity: 0.9;
        font-size: 1rem;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
      }

      .stat-card {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 1.5rem;
        transition: all 0.2s ease;
      }

      .stat-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 12px;
        flex-shrink: 0;
      }

      .stat-icon mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .stat-content {
        flex: 1;
      }

      .stat-content h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stat-value {
        margin: 0 0 0.25rem 0;
        font-size: 2rem;
        font-weight: 700;
        color: #333;
      }

      .stat-label {
        margin: 0;
        font-size: 0.875rem;
        color: #999;
      }

      .info-card {
        grid-column: 1 / -1;
        padding: 1.5rem;
      }

      .info-card h3 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
      }

      .info-card h3 mat-icon {
        color: #667eea;
      }

      .info-card p {
        margin: 0;
        color: #666;
        line-height: 1.6;
      }

      @media (max-width: 768px) {
        .header-content {
          flex-direction: column;
          text-align: center;
        }

        .dashboard-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class DashboardPage {}
