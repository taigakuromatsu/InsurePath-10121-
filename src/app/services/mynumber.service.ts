import { Injectable } from '@angular/core';

/**
 * MyNumber（マイナンバー）管理サービス
 *
 * ⚠️ 本番環境では暗号化とアクセス制御を強化すること
 */
@Injectable({
  providedIn: 'root'
})
export class MyNumberService {
  async encrypt(plainText: string): Promise<string> {
    if (!plainText || !/^\d{12}$/.test(plainText)) {
      throw new Error('Invalid MyNumber format');
    }
    return plainText;
  }

  async decrypt(encrypted: string): Promise<string> {
    return encrypted;
  }

  mask(myNumber: string | null | undefined): string {
    if (!myNumber || myNumber.length !== 12) {
      return '****-****-****';
    }
    return `*******${myNumber.slice(-4)}`;
  }

  isValid(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^\d{12}$/.test(value);
  }
}
