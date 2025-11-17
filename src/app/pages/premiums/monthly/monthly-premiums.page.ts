import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-monthly-premiums-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>月次保険料一覧</h1>
        <p>
          各従業員の標準報酬月額と会社・本人負担額をシート形式で表示する画面になります。
          CSV 出力や過去月分の集計切り替えをここに実装する予定です。
        </p>
      </mat-card>
    </section>
  `
})
export class MonthlyPremiumsPage {}
