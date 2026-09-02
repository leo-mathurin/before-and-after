import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module, no types on purpose (skill-internal interface)
import { attachList, formatMarkdown, formatText } from '../../skill/scripts/format.mjs';

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

describe('formatMarkdown attach mode (no urlMap)', () => {
  it('references images by ./relative local path for gh --attach rewriting', () => {
    const local = {
      mode: 'image',
      pairs: [
        {
          viewport: { name: 'desktop', width: 1440, height: 900 },
          before: image(`${process.cwd()}/captures/b.png`, 'x'),
          after: image(`${process.cwd()}/captures/a.png`, 'y'),
        },
      ],
    };
    const md = formatMarkdown(local, null);
    expect(md).toContain('![](./captures/b.png)');
    expect(md).toContain('| Before | After |');
  });

  it('puts videos on their own line under labels, never in table cells', () => {
    const video = {
      mode: 'video',
      pairs: [
        {
          viewport: { name: 'desktop', width: 1440, height: 900 },
          before: { file: `${process.cwd()}/captures/b.mp4`, kind: 'video', url: 'x' },
          after: { file: `${process.cwd()}/captures/a.mp4`, kind: 'video', url: 'y' },
        },
      ],
    };
    const md = formatMarkdown(video, null);
    expect(md).toContain('**Before**');
    expect(md).toContain('![before](./captures/b.mp4)');
    expect(md).not.toContain('|');
    expect(md).not.toContain('Click a frame');
  });

  it('labels after-only video as Preview', () => {
    const video = {
      mode: 'video',
      pairs: [
        {
          viewport: { name: 'mobile', width: 375, height: 812 },
          before: null,
          after: { file: `${process.cwd()}/a.mp4`, kind: 'video', url: 'y' },
        },
      ],
    };
    const md = formatMarkdown(video, null);
    expect(md).toContain('**Preview**');
    expect(md).not.toContain('Before');
  });
});

describe('attachList', () => {
  it('lists every capture file as a ./relative path', () => {
    const video = {
      mode: 'video',
      pairs: [
        {
          viewport: { name: 'desktop', width: 1440, height: 900 },
          before: { file: `${process.cwd()}/captures/b.mp4`, kind: 'video', url: 'x' },
          after: { file: `${process.cwd()}/captures/a.mp4`, kind: 'video', url: 'y' },
        },
      ],
    };
    expect(attachList(video)).toEqual(['./captures/b.mp4', './captures/a.mp4']);
  });
});

describe('formatText', () => {
  it('summarizes pairs with URLs when mapped, paths otherwise', () => {
    const text = formatText(manifest, urlMap);
    expect(text).toContain('Before → After (desktop 1440×900)');
    expect(text).toContain('https://blob/b.png');
  });
});
