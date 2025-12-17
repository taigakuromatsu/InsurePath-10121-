import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf } from '@angular/common';

export interface DisplayNameEditDialogData {
  currentDisplayName: string;
}

@Component({
  selector: 'ip-display-name-edit-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">edit</mat-icon>
      <span>ディスプレイネームを編集</span>
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>ディスプレイネーム</mat-label>
        <input matInput formControlName="displayName" required maxlength="120" />
        <mat-hint>1文字以上120文字以内で入力してください</mat-hint>
        <mat-error *ngIf="form.controls['displayName'].hasError('required')">
          ディスプレイネームを入力してください
        </mat-error>
        <mat-error *ngIf="form.controls['displayName'].hasError('maxlength')">
          120文字以内で入力してください
        </mat-error>
      </mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="onCancel()">
        キャンセル
      </button>
      <button mat-flat-button color="primary" type="submit" (click)="submit()" [disabled]="form.invalid">
        保存
      </button>
    </div>
  `,
  styles: [
    `
      h1[mat-dialog-title] {
        margin: 0;
        padding: 24px 24px 16px;
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
        line-height: 1.4;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      div[mat-dialog-content] {
        margin: 0;
        padding: 0 24px 24px;
        min-width: 400px;
      }

      .full-width {
        width: 100%;
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
export class DisplayNameEditDialogComponent {
  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    public readonly dialogRef: MatDialogRef<DisplayNameEditDialogComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: DisplayNameEditDialogData
  ) {
    this.form = this.fb.group({
      displayName: [data.currentDisplayName, [Validators.required, Validators.maxLength(120)]]
    });
  }

  onCancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close(this.form.value.displayName);
  }
}

