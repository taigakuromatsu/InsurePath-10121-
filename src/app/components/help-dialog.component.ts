import { Component, Inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { HelpTopic, HelpTopicId, getHelpTopics } from '../utils/help-content';

export interface HelpDialogData {
  topicIds: HelpTopicId[];
  title?: string;
}

@Component({
  selector: 'ip-help-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, NgFor, NgIf],
  template: `
    <h1 mat-dialog-title>
      <mat-icon>help_outline</mat-icon>
      {{ data.title || '社会保険制度のヘルプ' }}
    </h1>
    <div mat-dialog-content class="help-content">
      <div *ngFor="let topic of topics" class="help-topic">
        <h3 class="topic-title">{{ topic.title }}</h3>
        <p class="topic-content">{{ topic.content }}</p>
        <ul *ngIf="topic.points?.length" class="topic-points">
          <li *ngFor="let point of topic.points">{{ point }}</li>
        </ul>
        <p *ngIf="topic.notes" class="topic-notes">
          <strong>注意:</strong> {{ topic.notes }}
        </p>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close aria-label="ヘルプを閉じる">
        <mat-icon>close</mat-icon>
        閉じる
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 720px;
        width: 100%;
      }

      h1[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.35rem;
        font-weight: 600;
      }

      .help-content {
        max-height: 70vh;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .help-topic {
        margin-bottom: 2rem;
      }

      .help-topic:last-child {
        margin-bottom: 0;
      }

      .topic-title {
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0 0 0.75rem 0;
        color: #333;
      }

      .topic-content {
        margin: 0 0 1rem 0;
        line-height: 1.6;
        color: #555;
      }

      .topic-points {
        margin: 0 0 1rem 1.25rem;
        padding: 0;
        color: #444;
      }

      .topic-points li {
        margin-bottom: 0.5rem;
        line-height: 1.6;
      }

      .topic-notes {
        margin: 0;
        padding: 0.75rem 1rem;
        background: #fff3cd;
        border-left: 4px solid #ffc107;
        border-radius: 4px;
        color: #856404;
        line-height: 1.6;
      }

      @media (max-width: 768px) {
        .help-content {
          padding: 1rem;
        }

        h1[mat-dialog-title] {
          font-size: 1.15rem;
        }

        .topic-title {
          font-size: 1.05rem;
        }
      }
    `
  ]
})
export class HelpDialogComponent {
  readonly topics: HelpTopic[];

  constructor(@Inject(MAT_DIALOG_DATA) public data: HelpDialogData) {
    this.topics = getHelpTopics(data.topicIds);
  }
}
