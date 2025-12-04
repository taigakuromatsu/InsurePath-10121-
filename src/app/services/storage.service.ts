import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from '@angular/fire/storage';

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor(private readonly storage: Storage) {}

  /**
   * ファイル名をサニタイズ（特殊文字を置換）
   */
  private sanitizeFileName(fileName: string): string {
    // 特殊文字とスペースを _ に置換
    return fileName.replace(/[/\\:*?"<>|\s]/g, '_');
  }

  /**
   * ファイルをアップロードする
   * @param officeId 事業所ID
   * @param employeeId 従業員ID
   * @param documentId ドキュメントID
   * @param file アップロードするファイル
   * @returns Storageパス（文字列）
   */
  async uploadFile(
    officeId: string,
    employeeId: string,
    documentId: string,
    file: File
  ): Promise<string> {
    const sanitizedFileName = this.sanitizeFileName(file.name);
    const storagePath = `offices/${officeId}/employees/${employeeId}/documents/${documentId}/${sanitizedFileName}`;
    const storageRef = ref(this.storage, storagePath);
    
    // contentType をメタデータとして明示的に設定
    const metadata = {
      contentType: file.type || 'application/octet-stream'
    };
    
    await uploadBytes(storageRef, file, metadata);
    return storagePath;
  }

  /**
   * ファイルをダウンロードする（Blobとして取得）
   * @param storagePath Storageパス
   * @returns Blob
   */
  async downloadFile(storagePath: string): Promise<Blob> {
    const storageRef = ref(this.storage, storagePath);
    return await getBlob(storageRef);
  }

  /**
   * ダウンロードURLを取得する（一時URL、プレビュー用）
   * @param storagePath Storageパス
   * @returns ダウンロードURL
   */
  async getDownloadUrl(storagePath: string): Promise<string> {
    const storageRef = ref(this.storage, storagePath);
    return await getDownloadURL(storageRef);
  }

  /**
   * ファイルを削除する
   * @param storagePath Storageパス
   */
  async deleteFile(storagePath: string): Promise<void> {
    const storageRef = ref(this.storage, storagePath);
    await deleteObject(storageRef);
  }
}

