import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ip-requests-page',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>各種申請ワークフロー</h1>
        <p>
          従業員からのプロフィール変更や扶養申請を一覧化し、担当者が承認・差戻しを行う簡易ワークフローを提供します。
          状態別のフィルタやコメント履歴もこの画面で扱う予定です。
        </p>
        <button mat-stroked-button color="primary" disabled>承認フローを確認 (準備中)</button>
      </mat-card>
    </section>
  `
})
export class RequestsPage {}
