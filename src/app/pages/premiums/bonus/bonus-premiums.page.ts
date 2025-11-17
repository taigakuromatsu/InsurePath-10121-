import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-bonus-premiums-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>賞与保険料管理</h1>
        <p>
          年末調整や臨時支給に伴う賞与データと保険料控除の履歴を管理します。
          社会保険の年２回上限判定もここで実装予定です。
        </p>
      </mat-card>
    </section>
  `
})
export class BonusPremiumsPage {}
