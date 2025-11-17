import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ip-employees-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>従業員台帳</h1>
        <p>
          入社・退社、在籍ステータス、扶養情報を管理する画面です。
          後続ではここに検索や CSV インポート機能を実装予定です。
        </p>
      </mat-card>
    </section>
  `
})
export class EmployeesPage {}
