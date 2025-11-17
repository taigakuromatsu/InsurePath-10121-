import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-my-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>マイページ</h1>
        <p>
          従業員本人が自分の標準報酬月額や会社・本人負担額の推移、ダウンロード可能な明細を確認する画面です。
          後続では通知設定や申請状況もまとめて表示する予定です。
        </p>
      </mat-card>
    </section>
  `
})
export class MyPage {}
