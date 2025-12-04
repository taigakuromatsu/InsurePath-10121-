import { NgFor, NgIf } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';

import { Dependent } from '../../types';
import { getDependentRelationshipLabel } from '../../utils/label-utils';

export interface DependentSelectDialogData {
  dependents: Dependent[];
  title?: string;
  message?: string;
}

@Component({
  selector: 'ip-dependent-select-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, NgFor, NgIf, DatePipe],
  template: `
    <h1 mat-dialog-title>{{ data.title || '被扶養者を選択' }}</h1>
    <div mat-dialog-content>
      <p *ngIf="data.message" class="message">{{ data.message }}</p>
      <div class="dependent-list">
        <button
          mat-stroked-button
          class="dependent-item"
          *ngFor="let dependent of data.dependents"
          (click)="selectDependent(dependent)"
        >
          <div class="dependent-info">
            <div class="dependent-name">{{ dependent.name }}</div>
            <div class="dependent-details">
              <span class="detail-item">
                <mat-icon>people</mat-icon>
                {{ getDependentRelationshipLabel(dependent.relationship) }}
              </span>
              <span class="detail-item">
                <mat-icon>calendar_today</mat-icon>
                {{ dependent.dateOfBirth | date: 'yyyy-MM-dd' }}
              </span>
            </div>
          </div>
          <mat-icon class="select-icon">chevron_right</mat-icon>
        </button>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>キャンセル</button>
    </div>
  `,
  styles: [
    `
      .message {
        margin-bottom: 1rem;
        color: #666;
      }

      .dependent-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 400px;
        max-height: 400px;
        overflow-y: auto;
      }

      .dependent-item {
        width: 100%;
        padding: 1rem;
        text-align: left;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .dependent-info {
        flex: 1;
      }

      .dependent-name {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.25rem;
        color: #111827;
      }

      .dependent-details {
        display: flex;
        gap: 1rem;
        font-size: 0.875rem;
        color: #6b7280;
      }

      .detail-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .detail-item mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .select-icon {
        color: #667eea;
      }
    `
  ]
})
export class DependentSelectDialogComponent {
  protected readonly getDependentRelationshipLabel = getDependentRelationshipLabel;

  constructor(
    private readonly dialogRef: MatDialogRef<DependentSelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DependentSelectDialogData
  ) {}

  selectDependent(dependent: Dependent): void {
    this.dialogRef.close(dependent);
  }
}

