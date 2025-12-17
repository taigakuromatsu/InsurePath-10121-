import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ip-onboarding-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">welcome</mat-icon>
      <span>InsurePathへようこそ</span>
    </h1>
    <div mat-dialog-content>
      <p class="welcome-message">
        このシステムでは、社会保険料の計算・管理・手続きを効率的に行えます。
      </p>
      
      <div class="steps-container">
        <h3 class="steps-title">初回セットアップの手順</h3>
        
        <div class="step-item">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>事業所設定</h4>
            <p>事業所情報を設定します。</p>
          </div>
        </div>
        
        <div class="step-item">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>保険料率管理</h4>
            <p>健康保険・厚生年金などの保険料率を設定します。（健康保険・介護保険・厚生年金保険）</p>
          </div>
        </div>
        
        <div class="step-item">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>従業員台帳</h4>
            <p>従業員情報を登録します。（基本情報・標準報酬履歴・扶養家族情報）</p>
          </div>
        </div>
        
        <div class="step-item">
          <div class="step-number">4</div>
          <div class="step-content">
            <h4>月次保険料・賞与保険料</h4>
            <p>保険料を計算・確認します。</p>
          </div>
        </div>
      </div>
      
      <div class="note-box">
        <mat-icon>info</mat-icon>
        <p>サイドバーのメニューから順番に設定を進めてください。</p>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="onClose()">
        了解しました
      </button>
    </div>
  `,
  styles: [
    `
      h1[mat-dialog-title] {
        margin: 0;
        padding: 24px 24px 16px;
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      div[mat-dialog-content] {
        margin: 0;
        padding: 0 24px 24px;
        min-width: 500px;
        max-width: 600px;
      }

      .welcome-message {
        font-size: 1rem;
        line-height: 1.6;
        color: #555;
        margin: 0 0 24px 0;
      }

      .steps-container {
        margin-bottom: 24px;
      }

      .steps-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #333;
        margin: 0 0 16px 0;
      }

      .step-item {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
        align-items: flex-start;
      }

      .step-number {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--mat-sys-primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
      }

      .step-content {
        flex: 1;
      }

      .step-content h4 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #333;
      }

      .step-content p {
        font-size: 0.9rem;
        line-height: 1.5;
        color: #666;
        margin: 0;
      }

      .note-box {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        background-color: #e3f2fd;
        border-left: 4px solid #2196f3;
        border-radius: 4px;
      }

      .note-box mat-icon {
        color: #2196f3;
        margin-top: 2px;
      }

      .note-box p {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.5;
        color: #1565c0;
      }

      div[mat-dialog-actions] {
        padding: 8px 24px 24px;
        margin: 0;
        gap: 12px;
        min-height: auto;
      }
    `
  ]
})
export class OnboardingDialogComponent {
  constructor(public readonly dialogRef: MatDialogRef<OnboardingDialogComponent>) {}

  onClose(): void {
    this.dialogRef.close(true);
  }
}

