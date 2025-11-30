import { NgIf } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ChangeRequest } from '../../types';

@Component({
  selector: 'ip-reject-reason-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    NgIf
  ],
  template: `
    <h1 mat-dialog-title>却下理由を入力</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>却下理由</mat-label>
        <textarea matInput formControlName="reason" rows="4" maxlength="500"></textarea>
        <mat-hint>{{ form.get('reason')?.value?.length || 0 }} / 500</mat-hint>
      </mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
      <button mat-button color="warn" (click)="submit()" [disabled]="form.invalid">
        却下する
      </button>
    </div>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
    `
  ]
})
export class RejectReasonDialogComponent {
  form = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]]
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { request: ChangeRequest },
    private readonly dialogRef: MatDialogRef<RejectReasonDialogComponent>,
    private readonly fb: FormBuilder
  ) {}

  submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({ reason: this.form.get('reason')?.value });
  }
}
