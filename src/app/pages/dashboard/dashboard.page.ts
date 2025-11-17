import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-dashboard-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>InsurePath ダッシュボード</h1>
        <p>
          事業所全体の社会保険料負担や直近トレンドを集約して可視化する予定の画面です。
          将来的には KPI ウィジェットや最新アクティビティをここで確認します。
        </p>
      </mat-card>
    </section>
  `
})
export class DashboardPage {}
