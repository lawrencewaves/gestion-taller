import { describe, expect, it } from 'vitest';
import { databaseName } from './env';

describe('databaseName', () => {
  it('separa DEMO, LOCAL y cada rama de PREVIEW', () => {
    expect(databaseName({ environment: 'DEMO', version: '1' })).toBe('demo.db');
    expect(databaseName({ environment: 'LOCAL', version: '1' })).toBe('local.db');
    expect(databaseName({ environment: 'PREVIEW', version: '1', branch: 'feature/Fase-4 base' })).toBe('preview-feature-fase-4-base.db');
  });
});
