import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ip-simulator-page',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  template: `
    <section class="page">
      <mat-card>
        <h1>保険料シミュレーター</h1>
        <p>
          想定月給と賞与額を入力して、会社・本人それぞれの保険料負担を試算するツールを配置します。
          ここでは計算条件のテンプレート保存や比較も検討しています。
        </p>
        <button mat-raised-button color="primary" disabled>シミュレーションを開始 (準備中)</button>
      </mat-card>
    </section>
  `
})
export class SimulatorPage {}
