import { NgIf, NgFor } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, map } from 'rxjs';

import { ChangeRequestsService } from '../../services/change-requests.service';
import { CurrentUserService } from '../../services/current-user.service';
import { DependentsService } from '../../services/dependents.service';
import {
  CohabitationFlag,
  Dependent,
  DependentRelationship,
  DependentUpdatePayload,
  Sex
} from '../../types';
import { getDependentRelationshipLabel } from '../../utils/label-utils';

export interface DependentUpdateRequestFormDialogData {
  officeId: string;
  employeeId: string;
  dependentId: string;
}

@Component({
  selector: 'ip-dependent-update-request-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    NgIf,
    NgFor
  ],
  template: `
    <h1 mat-dialog-title>
      <mat-icon class="mr-2">edit</mat-icon>
      扶養家族変更申請
    </h1>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="dense-form">
      <div class="form-section mb-4" *ngIf="currentDependent">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">info</mat-icon> 現在の情報
        </h3>
        <div class="screen-rules">
          <p>
            <strong>氏名:</strong> {{ currentDependent.name }}<br>
            <span *ngIf="currentDependent.kana"><strong>カナ:</strong> {{ currentDependent.kana }}<br></span>
            <strong>続柄:</strong> {{ getDependentRelationshipLabel(currentDependent.relationship) }}<br>
            <strong>生年月日:</strong> {{ currentDependent.dateOfBirth }}
          </p>
        </div>
      </div>

      <div class="form-section">
        <h3 class="mat-h3 mb-2 flex-row align-center gap-2">
          <mat-icon color="primary">edit</mat-icon> 変更後の情報
        </h3>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>氏名（漢字）</mat-label>
          <input matInput formControlName="name" required />
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            氏名を入力してください
          </mat-error>
          <mat-error *ngIf="form.get('name')?.hasError('maxlength')">
            氏名は50文字以内で入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>氏名（カナ）</mat-label>
          <input matInput formControlName="kana" />
        </mat-form-field>

        <div class="form-row flex-row gap-2 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>続柄</mat-label>
            <mat-select formControlName="relationship" required>
              <mat-option [value]="''">未選択</mat-option>
              <mat-option *ngFor="let rel of relationships" [value]="rel">
                {{ getDependentRelationshipLabel(rel) }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('relationship')?.hasError('required')">
              続柄を選択してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>生年月日</mat-label>
            <input matInput formControlName="dateOfBirth" type="date" required />
            <mat-error *ngIf="form.get('dateOfBirth')?.hasError('required')">
              生年月日を入力してください
            </mat-error>
            <mat-error *ngIf="form.get('dateOfBirth')?.hasError('pattern')">
              YYYY-MM-DD形式で入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>性別</mat-label>
            <mat-select formControlName="sex">
              <mat-option [value]="null">未選択</mat-option>
              <mat-option value="male">男性</mat-option>
              <mat-option value="female">女性</mat-option>
              <mat-option value="other">その他</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row flex-row gap-2 flex-wrap">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>郵便番号</mat-label>
            <input
              matInput
              formControlName="postalCode"
              placeholder="1234567"
              maxlength="7"
              inputmode="numeric"
            />
            <mat-hint>7桁の数字（ハイフンなし）</mat-hint>
            <mat-error *ngIf="form.get('postalCode')?.hasError('pattern')">
              7桁の数字を入力してください
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>同居／別居</mat-label>
            <mat-select formControlName="cohabitationFlag">
              <mat-option [value]="null">未選択</mat-option>
              <mat-option value="cohabiting">同居</mat-option>
              <mat-option value="separate">別居</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>住所</mat-label>
          <textarea matInput formControlName="address" rows="2"></textarea>
        </mat-form-field>

        <mat-checkbox formControlName="isWorking">就労している</mat-checkbox>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          <mat-icon>send</mat-icon>
          申請する
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .mr-2 { margin-right: 8px; }
      .flex-1 { flex: 1; }
      
      .screen-rules {
        padding: 12px;
        background: #f5f7fa;
        border-radius: 4px;
        font-size: 13px;
        color: #666;
        border-left: 3px solid #1a237e;
        
        p { margin: 0; line-height: 1.5; }
      }

      mat-checkbox {
        margin-top: 0.5rem;
      }
    `
  ]
})
export class DependentUpdateRequestFormDialogComponent {
  private readonly currentUser = inject(CurrentUserService);
  private readonly changeRequestsService = inject(ChangeRequestsService);
  private readonly dependentsService = inject(DependentsService);
  private readonly fb = inject(FormBuilder);

  protected readonly relationships: DependentRelationship[] = [
    'spouse',
    'child',
    'parent',
    'grandparent',
    'sibling',
    'other'
  ];

  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;

  currentDependent: Dependent | null = null;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    kana: [''],
    relationship: ['', Validators.required],
    dateOfBirth: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    sex: [null as Sex | null],
    postalCode: ['', Validators.pattern(/^\d{7}$/)],
    address: [''],
    cohabitationFlag: [null as CohabitationFlag | null],
    isWorking: [false]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<DependentUpdateRequestFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: DependentUpdateRequestFormDialogData
  ) {
    this.loadCurrentDependent();
  }

  private async loadCurrentDependent(): Promise<void> {
    try {
      const dependents = await firstValueFrom(
        this.dependentsService.list(this.data.officeId, this.data.employeeId)
      );
      const dependent = dependents.find((d) => d.id === this.data.dependentId);
      if (dependent) {
        this.currentDependent = dependent;
        this.form.patchValue({
          name: dependent.name,
          kana: dependent.kana ?? '',
          relationship: dependent.relationship,
          dateOfBirth: dependent.dateOfBirth,
          sex: dependent.sex ?? null,
          postalCode: dependent.postalCode ?? '',
          address: dependent.address ?? '',
          cohabitationFlag: dependent.cohabitationFlag ?? null,
          isWorking: false // Dependent型には存在しないため、デフォルト値
        });
      }
    } catch (error) {
      console.error('Failed to load dependent', error);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    const currentUserId = await firstValueFrom(
      this.currentUser.profile$.pipe(map((profile) => profile?.id ?? null))
    );

    if (!currentUserId) {
      throw new Error('ユーザーIDが取得できませんでした');
    }

    const payload: DependentUpdatePayload = {
      name: formValue.name ?? '',
      kana: formValue.kana || undefined,
      relationship: formValue.relationship as DependentRelationship,
      dateOfBirth: formValue.dateOfBirth ?? '',
      sex: formValue.sex ?? undefined,
      postalCode: formValue.postalCode || undefined,
      address: formValue.address || undefined,
      cohabitationFlag: formValue.cohabitationFlag ?? undefined,
      isWorking: formValue.isWorking ?? undefined
    };

    await this.changeRequestsService.create(this.data.officeId, {
      employeeId: this.data.employeeId,
      requestedByUserId: currentUserId,
      kind: 'dependent_update',
      targetDependentId: this.data.dependentId,
      payload
    });

    this.dialogRef.close(true);
  }
}

