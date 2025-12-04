import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { from, map, Observable, firstValueFrom } from 'rxjs';

import {
  DocumentAttachment,
  DocumentRequest,
  DocumentCategory,
  DocumentRequestStatus
} from '../types';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(
    private readonly firestore: Firestore,
    private readonly storageService: StorageService
  ) {}

  private documentsCollectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'documents');
  }

  private documentRequestsCollectionPath(officeId: string) {
    return collection(this.firestore, 'offices', officeId, 'documentRequests');
  }

  /**
   * オブジェクトから再帰的に undefined フィールドを除去する
   * Firestore は undefined 値をサポートしていないため、保存前にクリーンアップが必要
   */
  private removeUndefinedDeep<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.removeUndefinedDeep(v)) as unknown as T;
    }

    const result: any = {};
    for (const [key, v] of Object.entries(value as any)) {
      if (v === undefined) {
        continue;
      }
      result[key] = this.removeUndefinedDeep(v);
    }
    return result;
  }

  // ========== DocumentAttachment 関連 ==========

  /**
   * 添付書類一覧を取得（リアルタイム購読）
   */
  listAttachments(
    officeId: string,
    employeeId?: string,
    category?: DocumentCategory
  ): Observable<DocumentAttachment[]> {
    const ref = this.documentsCollectionPath(officeId);
    const conditions: any[] = [];

    if (employeeId) {
      conditions.push(where('employeeId', '==', employeeId));
    }
    if (category) {
      conditions.push(where('category', '==', category));
    }

    const q = query(ref, ...conditions, orderBy('uploadedAt', 'desc'));

    return collectionData(q, { idField: 'id' }).pipe(
      map((docs) => docs as DocumentAttachment[])
    );
  }

  /**
   * 単一の添付書類を取得
   */
  getAttachment(officeId: string, documentId: string): Observable<DocumentAttachment | null> {
    const ref = doc(this.documentsCollectionPath(officeId), documentId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return { id: snapshot.id, ...(snapshot.data() as any) } as DocumentAttachment;
      })
    );
  }

  /**
   * 添付書類を作成
   */
  async createAttachment(
    officeId: string,
    attachment: Omit<DocumentAttachment, 'id' | 'officeId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const ref = this.documentsCollectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();
  
    const payload: DocumentAttachment = {
      ...attachment,
      id: docRef.id,
      officeId,                  
      createdAt: now,
      updatedAt: now,
      uploadedAt: attachment.uploadedAt || now
    };
  
    const cleaned = this.removeUndefinedDeep(payload);
    await setDoc(docRef, cleaned);
  }
  

  /**
   * 添付書類を更新（メモ、有効期限など）
   */
  async updateAttachment(
    officeId: string,
    documentId: string,
    updates: Partial<DocumentAttachment>
  ): Promise<void> {
    const ref = doc(this.documentsCollectionPath(officeId), documentId);
    const now = new Date().toISOString();

    const updateData: any = {
      ...updates,
      updatedAt: now
    };

    const cleaned = this.removeUndefinedDeep(updateData);
    await updateDoc(ref, cleaned);
  }

  /**
   * 添付書類を削除（StorageとFirestoreの両方から削除）
   */
  async deleteAttachment(officeId: string, documentId: string): Promise<void> {
    const attachment = await firstValueFrom(
      this.getAttachment(officeId, documentId)
    );
  
    if (!attachment) {
      throw new Error('Document not found');
    }
  
    try {
      await this.storageService.deleteFile(attachment.storagePath);
    } catch (error) {
      console.warn('Failed to delete file from Storage:', error);
    }
  
    const ref = doc(this.documentsCollectionPath(officeId), documentId);
    await deleteDoc(ref);
  }

  // ========== DocumentRequest 関連 ==========

  /**
   * 書類アップロード依頼一覧を取得（リアルタイム購読）
   */
  listRequests(
    officeId: string,
    employeeId?: string,
    status?: DocumentRequestStatus
  ): Observable<DocumentRequest[]> {
    const ref = this.documentRequestsCollectionPath(officeId);
    const conditions: any[] = [];

    if (employeeId) {
      conditions.push(where('employeeId', '==', employeeId));
    }
    if (status) {
      conditions.push(where('status', '==', status));
    }

    const q = query(ref, ...conditions, orderBy('createdAt', 'desc'));

    return collectionData(q, { idField: 'id' }).pipe(
      map((docs) => docs as DocumentRequest[])
    );
  }

  /**
   * 単一の書類アップロード依頼を取得
   */
  getRequest(officeId: string, requestId: string): Observable<DocumentRequest | null> {
    const ref = doc(this.documentRequestsCollectionPath(officeId), requestId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }
        return { id: snapshot.id, ...(snapshot.data() as any) } as DocumentRequest;
      })
    );
  }

  /**
   * 書類アップロード依頼を作成
   */
  async createRequest(
    officeId: string,
    request: Omit<DocumentRequest, 'id' | 'officeId' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const ref = this.documentRequestsCollectionPath(officeId);
    const docRef = doc(ref);
    const now = new Date().toISOString();
  
    const payload: DocumentRequest = {
      ...request,
      id: docRef.id,
      officeId,               
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
  
    const cleaned = this.removeUndefinedDeep(payload);
    await setDoc(docRef, cleaned);
  }
  
  /**
   * 書類アップロード依頼のステータスを更新
   */
  async updateRequestStatus(
    officeId: string,
    requestId: string,
    status: DocumentRequestStatus
  ): Promise<void> {
    const ref = doc(this.documentRequestsCollectionPath(officeId), requestId);
    const now = new Date().toISOString();

    const updateData: any = {
      status,
      updatedAt: now
    };

    // status === 'uploaded' の場合は resolvedAt も設定
    if (status === 'uploaded') {
      updateData.resolvedAt = now;
    }

    const cleaned = this.removeUndefinedDeep(updateData);
    await updateDoc(ref, cleaned);
  }
}

