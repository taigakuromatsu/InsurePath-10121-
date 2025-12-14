import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  Firestore,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';

import {
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
  ChangeRequestPayload
} from '../types';

@Injectable({ providedIn: 'root' })
export class ChangeRequestsService {
  private readonly injector = inject(EnvironmentInjector);
  constructor(private readonly firestore: Firestore) {}

  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private inCtxAsync<T>(fn: () => Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, fn);
  }

  private collectionPath(officeId: string) {
    return this.inCtx(() => collection(this.firestore, 'offices', officeId, 'changeRequests'));
  }

  /**
   * オブジェクトから再帰的に undefined フィールドを除去する
   * Firestore は undefined 値をサポートしていないため、保存前にクリーンアップが必要
   * @param value クリーンアップ対象の値
   * @returns undefined が除去された値
   */
  private removeUndefinedDeep<T>(value: T): T {
    // null やプリミティブ型はそのまま返す
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // 配列の場合は各要素を再帰的に処理
    if (Array.isArray(value)) {
      return value.map((v) => this.removeUndefinedDeep(v)) as unknown as T;
    }

    // オブジェクトの場合は各プロパティを再帰的に処理し、undefined は除外
    const result: any = {};
    for (const [key, v] of Object.entries(value as any)) {
      if (v === undefined) {
        // undefined はフィールドごと削除
        continue;
      }
      result[key] = this.removeUndefinedDeep(v);
    }
    return result;
  }

  async create(
    officeId: string,
    request: {
      employeeId: string;
      requestedByUserId: string;
      kind: ChangeRequestKind;
      field?: ChangeRequest['field'];
      currentValue?: string;
      requestedValue?: string;
      targetDependentId?: string;
      payload?: ChangeRequestPayload;
    }
  ): Promise<void> {
    return this.inCtxAsync(async () => {
    const ref = this.collectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();

    const payload: ChangeRequest = {
      id: docRef.id,
      officeId,
      employeeId: request.employeeId,
      requestedByUserId: request.requestedByUserId,
      kind: request.kind ?? 'profile',
      field: request.field,
      currentValue: request.currentValue,
      requestedValue: request.requestedValue,
      targetDependentId: request.targetDependentId,
      payload: request.payload,
      status: 'pending',
      requestedAt: now
    };

    // 再帰的に undefined フィールドを除外してから Firestore に書き込む
    // Firestore は undefined 値をサポートしていないため（ネストされたオブジェクト内も含む）
    const cleaned = this.removeUndefinedDeep(payload);

    await setDoc(docRef, cleaned);
    });
  }

  list(officeId: string, status?: ChangeRequestStatus, limitCount?: number): Observable<ChangeRequest[]> {
    return this.inCtx(() => {
    const ref = this.collectionPath(officeId);
    const constraints: any[] = [];
    
    if (status) {
      constraints.push(where('status', '==', status));
    }
    constraints.push(orderBy('requestedAt', 'desc'));
    
    if (limitCount != null) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(ref, ...constraints);

    return (collectionData(q, { idField: 'id' }) as Observable<ChangeRequest[]>)
      .pipe(map((requests) => requests.map((req) => this.normalizeRequest(req))));
    });
  }

  listForUser(
    officeId: string,
    userId: string,
    status?: ChangeRequestStatus,
    limitCount?: number
  ): Observable<ChangeRequest[]> {
    return this.inCtx(() => {
    const ref = this.collectionPath(officeId);
    const constraints: any[] = [
      where('requestedByUserId', '==', userId)
    ];
    
    if (status) {
      constraints.push(where('status', '==', status));
    }
    constraints.push(orderBy('requestedAt', 'desc'));
    
    if (limitCount != null) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(ref, ...constraints);

    return (collectionData(q, { idField: 'id' }) as Observable<ChangeRequest[]>)
      .pipe(map((requests) => requests.map((req) => this.normalizeRequest(req))));
    });
  }

  async approve(officeId: string, requestId: string, decidedByUserId: string): Promise<void> {
    return this.inCtxAsync(async () => {
    const docRef = doc(this.collectionPath(officeId), requestId);
    const now = new Date().toISOString();

    await updateDoc(docRef, {
      status: 'approved',
      decidedAt: now,
      decidedByUserId
      });
    });
  }

  async reject(
    officeId: string,
    requestId: string,
    decidedByUserId: string,
    rejectReason: string
  ): Promise<void> {
    return this.inCtxAsync(async () => {
    const docRef = doc(this.collectionPath(officeId), requestId);
    const now = new Date().toISOString();

    await updateDoc(docRef, {
      status: 'rejected',
      decidedAt: now,
      decidedByUserId,
      rejectReason
      });
    });
  }

  async cancel(officeId: string, requestId: string): Promise<void> {
    return this.inCtxAsync(async () => {
    const docRef = doc(this.collectionPath(officeId), requestId);

    await updateDoc(docRef, {
      status: 'canceled'
      });
    });
  }

  private normalizeRequest(data: ChangeRequest): ChangeRequest {
    // 既存データとの互換性: 'email' を 'contactEmail' に正規化
    // data.field が 'email' の場合（レガシーデータ）も 'contactEmail' として扱う
    const normalizedField =
      (data.field as string) === 'email'
        ? 'contactEmail'
        : data.field;

    return {
      ...data,
      field: normalizedField,
      kind: data.kind ?? 'profile'
    };
  }
}
