import { describe, expect, it } from 'vitest';
import { ilgiEki, upper } from './text.js';

describe('upper — Türkçe büyük harf', () => {
  it('noktalı/noktasız I ayrımını korur', () => {
    expect(upper('Gizem')).toBe('GİZEM');
    expect(upper('ışık')).toBe('IŞIK');
  });
});

/*
 * Mesajlar İngilizce kalıptan çevrildiği için isimler ham yapıştırılıyordu:
 * "NORDİK SAYI", "1. SET NORDİK". Ev sahibi tarafı doğruydu
 * ("TÜRKİYE'NİN"), rakip tarafı değildi.
 */
describe('ilgiEki — Türkçe ilgi eki', () => {
  it('ünlü uyumuna göre ek seçer', () => {
    expect(ilgiEki('ATLAS')).toBe("ATLAS'IN");   // son ünlü A → ın
    expect(ilgiEki('NORDİK')).toBe("NORDİK'İN"); // son ünlü İ → in
    expect(ilgiEki('BALKAN')).toBe("BALKAN'IN");
    expect(ilgiEki('PASİFİK')).toBe("PASİFİK'İN");
  });

  it('yuvarlak ünlülerde un/ün kullanır', () => {
    expect(ilgiEki('BOSTON')).toBe("BOSTON'UN");
    expect(ilgiEki('ÖRGÜ')).toBe("ÖRGÜ'NÜN");
  });

  it('ünlüyle biten adda kaynaştırma n si girer', () => {
    expect(ilgiEki('ADRİYA')).toBe("ADRİYA'NIN");
    expect(ilgiEki('TÜRKİYE')).toBe("TÜRKİYE'NİN");
  });

  it('eki Türkçe büyük harfle yazar (IN, İN değil)', () => {
    // Varsayılan toUpperCase 'ın' → 'IN' yerine yanlış eşleme yapabilir
    expect(ilgiEki('ATLAS').endsWith('IN')).toBe(true);
    expect(ilgiEki('NORDİK').endsWith('İN')).toBe(true);
  });

  it('ünlüsüz ya da boş girdide çökmez', () => {
    expect(ilgiEki('')).toBe('');
    expect(ilgiEki(null)).toBe('');
    expect(ilgiEki('KRK')).toBe("KRK'İN");
  });
});
