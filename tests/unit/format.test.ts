import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module, no types on purpose (skill-internal interface)
import { formatMarkdown, formatText } from '../../skill/scripts/format.mjs';

const image = (file: string, url: string) => ({ file, kind: 'image', url });

const manifest = {
  mode: 'image',
  pairs: [
    {
      viewport: { name: 'desktop', width: 1440, height: 900 },
      before: image('/tmp/pricing-desktop-before.png', 'https://prod/pricing'),
      after: image('/tmp/pricing-desktop-after.png', 'https://preview/pricing'),
    },
  ],
};

const urlMap = {
  '/tmp/pricing-desktop-before.png': 'https://blob/b.png',
  '/tmp/pricing-desktop-after.png': 'https://blob/a.png',
};

describe('formatMarkdown', () => {
  it('emits a side-by-side table with public URLs', () => {
    const md = formatMarkdown(manifest, urlMap);
    expect(md).toContain('| Before | After |');
    expect(md).toContain('![](https://blob/b.png)');
    expect(md).toContain('![](https://blob/a.png)');
  });

  it('titles after-only captures as Preview', () => {
    const only = { ...manifest, pairs: [{ ...manifest.pairs[0], before: null }] };
    const md = formatMarkdown(only, urlMap);
    expect(md).toContain('| Preview |');
    expect(md).not.toContain('Before');
  });

  it('renders video cells as poster frames linked to the mp4', () => {
    const video = {
      mode: 'video',
      pairs: [
        {
          viewport: { name: 'desktop', width: 1440, height: 900 },
          before: null,
          after: { file: '/tmp/a.mp4', poster: '/tmp/a-poster.png', kind: 'video', url: 'x' },
        },
      ],
    };
    const md = formatMarkdown(video, {
      '/tmp/a.mp4': 'https://blob/a.mp4',
      '/tmp/a-poster.png': 'https://blob/a-poster.png',
    });
    expect(md).toContain('[![video](https://blob/a-poster.png)](https://blob/a.mp4)');
    expect(md).toContain('Click a frame to play');
  });

  it('adds attribution and markers when asked', () => {
    const md = formatMarkdown(manifest, urlMap, { attribution: '@website-agent', markers: true });
    expect(md.startsWith('<!-- website-agent:before-after:start -->')).toBe(true);
    expect(md).toContain('Before/after by @website-agent');
    expect(md.trimEnd().endsWith('<!-- website-agent:before-after:end -->')).toBe(true);
  });

  it('throws when a file has no uploaded URL', () => {
    expect(() => formatMarkdown(manifest, {})).toThrow(/No public URL/);
  });

  it('labels viewports when there are several', () => {
    const two = {
      ...manifest,
      pairs: [
        manifest.pairs[0],
        {
          viewport: { name: 'mobile', width: 375, height: 812 },
          before: image('/tmp/pricing-mobile-before.png', 'x'),
          after: image('/tmp/pricing-mobile-after.png', 'y'),
        },
      ],
    };
    const md = formatMarkdown(two, {
      ...urlMap,
      '/tmp/pricing-mobile-before.png': 'https://blob/mb.png',
      '/tmp/pricing-mobile-after.png': 'https://blob/ma.png',
    });
    expect(md).toContain('Before (desktop, 1440×900)');
    expect(md).toContain('After (mobile, 375×812)');
  });
});

describe('formatText', () => {
  it('summarizes pairs with URLs when mapped, paths otherwise', () => {
    const text = formatText(manifest, urlMap);
    expect(text).toContain('Before → After (desktop 1440×900)');
    expect(text).toContain('https://blob/b.png');
  });
});
