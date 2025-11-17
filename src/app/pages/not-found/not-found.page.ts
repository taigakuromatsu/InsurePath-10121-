import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ip-not-found-page',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, RouterLink],
  template: `
    <section class="page">
      <mat-card>
        <h1>ページが見つかりません</h1>
        <p>指定されたパスの画面はまだ用意されていません。ナビゲーションから目的の画面を選択してください。</p>
        <a mat-stroked-button color="primary" routerLink="/dashboard">ダッシュボードに戻る</a>
      </mat-card>
    </section>
  `
})
export class NotFoundPage {}
