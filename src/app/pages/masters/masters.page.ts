import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-masters-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>マスタ管理</h1>
        <p>
          保険料率や標準報酬等級、法定利率といった参照データを一元管理します。
          各年度の改定履歴を登録し、ページ全体へ即時に反映させる仕組みを想定しています。
        </p>
      </mat-card>
    </section>
  `
})
export class MastersPage {}
