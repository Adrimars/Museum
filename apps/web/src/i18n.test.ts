// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import i18n from './i18n';

describe('i18n setup', () => {
  it('initializes with Turkish defaults', async () => {
    await i18n.changeLanguage('tr');

    expect(i18n.language).toBe('tr');
    expect(i18n.t('auth.login')).toBe('Giriş Yap');
  });

  it('supports English translations', async () => {
    await i18n.changeLanguage('en');

    expect(i18n.t('auth.login')).toBe('Log In');
  });
});
