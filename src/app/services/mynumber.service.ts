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
  /**
   * MyNumberの正規表現パターン（12桁の数字のみ）
   * encrypt / isValid の両方で使用する
   */
  private static readonly MY_NUMBER_PATTERN = /^\d{12}$/;

  async encrypt(plainText: string): Promise<string> {
    if (!plainText || !MyNumberService.MY_NUMBER_PATTERN.test(plainText)) {
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
    return MyNumberService.MY_NUMBER_PATTERN.test(value);
  }
}
