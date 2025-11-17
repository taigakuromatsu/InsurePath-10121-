import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-offices-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>事業所・健康保険プラン管理</h1>
        <p>
          会社情報、適用する健康保険組合、標準報酬月額テーブルなどの設定を行う予定です。
          ここで編集した内容が各従業員の計算に反映されます。
        </p>
      </mat-card>
    </section>
  `
})
export class OfficesPage {}
