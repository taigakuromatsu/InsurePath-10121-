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
    <h1 mat-dialog-title>扶養家族変更申請</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div mat-dialog-content>
        <div class="current-info" *ngIf="currentDependent">
          <h3>現在の情報</h3>
          <div class="info-item">
            <span class="label">氏名:</span>
            <span class="value">{{ currentDependent.name }}</span>
          </div>
          <div class="info-item" *ngIf="currentDependent.kana">
            <span class="label">カナ:</span>
            <span class="value">{{ currentDependent.kana }}</span>
          </div>
          <div class="info-item">
            <span class="label">続柄:</span>
            <span class="value">
              {{ getDependentRelationshipLabel(currentDependent.relationship) }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">生年月日:</span>
            <span class="value">{{ currentDependent.dateOfBirth }}</span>
          </div>
        </div>

        <h3 class="section-title">変更後の情報</h3>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>氏名（漢字）</mat-label>
          <input matInput formControlName="name" required />
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            氏名を入力してください
          </mat-error>
          <mat-error *ngIf="form.get('name')?.hasError('maxlength')">
            氏名は50文字以内で入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>氏名（カナ）</mat-label>
          <input matInput formControlName="kana" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
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

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>生年月日</mat-label>
          <input matInput formControlName="dateOfBirth" type="date" required />
          <mat-error *ngIf="form.get('dateOfBirth')?.hasError('required')">
            生年月日を入力してください
          </mat-error>
          <mat-error *ngIf="form.get('dateOfBirth')?.hasError('pattern')">
            YYYY-MM-DD形式で入力してください
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>性別</mat-label>
          <mat-select formControlName="sex">
            <mat-option [value]="null">未選択</mat-option>
            <mat-option value="male">男性</mat-option>
            <mat-option value="female">女性</mat-option>
            <mat-option value="other">その他</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
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

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>住所</mat-label>
          <textarea matInput formControlName="address" rows="2"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>同居／別居</mat-label>
          <mat-select formControlName="cohabitationFlag">
            <mat-option [value]="null">未選択</mat-option>
            <mat-option value="cohabiting">同居</mat-option>
            <mat-option value="separate">別居</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox formControlName="isWorking">就労している</mat-checkbox>
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close type="button">キャンセル</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          <mat-icon>send</mat-icon>
          申請する
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }

      .current-info {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
      }

      .current-info h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .info-item {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }

      .info-item .label {
        font-weight: 600;
        min-width: 80px;
      }

      .section-title {
        margin: 1rem 0 0.5rem 0;
        font-size: 1rem;
        font-weight: 600;
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

