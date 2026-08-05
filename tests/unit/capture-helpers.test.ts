import { describe, expect, it } from 'vitest';
// @ts-ignore — plain .mjs module, no types on purpose (skill-internal interface)
import { pathSlug, resolveViewport, VIEWPORT_PRESETS } from '../../skill/scripts/capture.mjs';

describe('resolveViewport', () => {
  it('resolves presets', () => {
    expect(resolveViewport('mobile')).toEqual({ name: 'mobile', ...VIEWPORT_PRESETS.mobile });
  });

  it('resolves WxH strings', () => {
    expect(resolveViewport('1920x1080')).toEqual({ name: '1920x1080', width: 1920, height: 1080 });
  });

  it('rejects garbage', () => {
    expect(() => resolveViewport('huge')).toThrow(/Unknown viewport/);
  });
});

describe('pathSlug', () => {
  it('slugs pathnames', () => {
    expect(pathSlug('https://vercel.com/products/previews')).toBe('products-previews');
  });

  it('uses home for the root path', () => {
    expect(pathSlug('https://vercel.com/')).toBe('home');
  });

  it('falls back for invalid URLs', () => {
    expect(pathSlug('not a url')).toBe('page');
  });
});
