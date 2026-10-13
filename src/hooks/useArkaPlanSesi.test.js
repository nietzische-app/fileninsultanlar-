import { describe, it, expect } from 'vitest';
import { arkaPlanSesi } from './useArkaPlanSesi.js';

describe('arka plan sesi', () => {
  it('gizliyken suspend, görünürken resume', () => {
    expect(arkaPlanSesi(false)).toBe('suspend');
    expect(arkaPlanSesi(true)).toBe('resume');
  });
});
