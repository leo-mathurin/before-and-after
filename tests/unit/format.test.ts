import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-ignore — plain .mjs module, no types on purpose (skill-internal interface)
import {
  MARKER_END,
  MARKER_START,
  attachList,
  buildPairs,
  formatMarkdown,
  localRef,
  mediaKind,
  replaceMarkedBlock,
} from '../../skill/scripts/format.mjs';

const pair = (before: string | null, after: string, label: string | null = null) => ({ before, after, label });

describe('mediaKind', () => {
  it.each([
    ['capture.PNG', 'image'],
    ['capture.jpeg', 'image'],
    ['capture.jpg', 'image'],
    ['capture.gif', 'image'],
    ['capture.webp', 'image'],
    ['capture.MP4', 'video'],
    ['capture.mov', 'video'],
    ['capture.webm', 'video'],
  ])('classifies %s as %s', (file, kind) => {
    expect(mediaKind(file)).toBe(kind);
  });

  it('rejects unsupported files', () => {
    expect(() => mediaKind('capture.svg')).toThrow(/Unsupported media/);
  });
});

describe('localRef', () => {
  it('produces gh-compatible relative references', () => {
    expect(localRef('/repo/captures/after.png', '/repo')).toBe('./captures/after.png');
  });

  it('rejects whitespace because attachment refs must match exactly', () => {
    expect(() => localRef('/repo/captures/after image.png', '/repo')).toThrow(/whitespace/);
  });

  it('rejects media outside the working directory', () => {
    expect(() => localRef('/tmp/after.png', '/repo')).toThrow(/inside the working directory/);
  });
});

describe('buildPairs', () => {
  it('pairs corresponding before and after files', () => {
    expect(buildPairs({ before: ['b1.png', 'b2.png'], after: ['a1.png', 'a2.png'], labels: ['Desktop'] })).toEqual([
      pair('b1.png', 'a1.png', 'Desktop'),
      pair('b2.png', 'a2.png'),
    ]);
  });

  it('builds after-only preview pairs', () => {
    expect(buildPairs({ after: ['a.png'] })).toEqual([pair(null, 'a.png')]);
  });

  it('requires at least one after file', () => {
    expect(() => buildPairs({})).toThrow(/At least one --after/);
  });

  it('rejects mismatched pair counts', () => {
    expect(() => buildPairs({ before: ['b.png'], after: ['a1.png', 'a2.png'] })).toThrow(/one --before file/);
  });

  it('rejects excess labels', () => {
    expect(() => buildPairs({ after: ['a.png'], labels: ['One', 'Two'] })).toThrow(/at most one --label/);
  });
});

describe('formatMarkdown', () => {
  it('wraps image pairs in stable markers and a table', () => {
    const markdown = formatMarkdown([pair('/repo/captures/b.png', '/repo/captures/a.png')], { cwd: '/repo' });
    expect(markdown).toBe([
      MARKER_START,
      '| Before | After |',
      '|:---:|:---:|',
      '| ![Before](./captures/b.png) | ![After](./captures/a.png) |',
      '',
      MARKER_END,
      '',
    ].join('\n'));
  });

  it('renders after-only images as Preview', () => {
    const markdown = formatMarkdown([pair(null, '/repo/captures/a.png')], { cwd: '/repo' });
    expect(markdown).toContain('| Preview |');
    expect(markdown).toContain('![Preview](./captures/a.png)');
    expect(markdown).not.toContain('Before');
  });

  it('labels multiple pairs', () => {
    const markdown = formatMarkdown([
      pair('/repo/b1.png', '/repo/a1.png', 'Desktop'),
      pair('/repo/b2.png', '/repo/a2.png', 'Mobile'),
    ], { cwd: '/repo' });
    expect(markdown).toContain('| Before (Desktop) | After (Desktop) |');
    expect(markdown).toContain('| Before (Mobile) | After (Mobile) |');
  });

  it('adds attribution inside the marker block', () => {
    const markdown = formatMarkdown([pair(null, '/repo/a.png')], { attribution: '@agent', cwd: '/repo' });
    expect(markdown).toContain(`${MARKER_START}\n> Before/after by @agent`);
  });

  it('puts videos on their own lines instead of table cells', () => {
    const markdown = formatMarkdown([pair('/repo/b.webm', '/repo/a.webm')], { cwd: '/repo' });
    expect(markdown).toContain('**Before**\n\n![Before](./b.webm)');
    expect(markdown).toContain('**After**\n\n![After](./a.webm)');
    expect(markdown).not.toContain('|');
  });

  it('renders after-only videos as Preview', () => {
    const markdown = formatMarkdown([pair(null, '/repo/a.mp4', 'Checkout')], { cwd: '/repo' });
    expect(markdown).toContain('**Preview (Checkout)**');
    expect(markdown).toContain('![Preview](./a.mp4)');
  });

  it('supports image and video pairs in one block', () => {
    const markdown = formatMarkdown([
      pair('/repo/b.png', '/repo/a.png', 'Static'),
      pair('/repo/b.mp4', '/repo/a.mp4', 'Motion'),
    ], { cwd: '/repo' });
    expect(markdown).toContain('| Before (Static) | After (Static) |');
    expect(markdown).toContain('**Before (Motion)**');
  });

  it('rejects mixed media within a pair', () => {
    expect(() => formatMarkdown([pair('/repo/b.png', '/repo/a.mp4')], { cwd: '/repo' })).toThrow(/same media type/);
  });
});

describe('attachList', () => {
  it('returns every file once in publish order', () => {
    expect(attachList([
      pair('/repo/b.png', '/repo/a.png'),
      pair(null, '/repo/a.png'),
      pair(null, '/repo/preview.webm'),
    ], { cwd: '/repo' })).toEqual(['./b.png', './a.png', './preview.webm']);
  });
});

describe('replaceMarkedBlock', () => {
  const block = `${MARKER_START}\nnew media\n${MARKER_END}\n`;

  it('appends to a body without markers', () => {
    expect(replaceMarkedBlock('Intro\n', block)).toBe(`Intro\n\n${block}`);
  });

  it('returns only the block for an empty body', () => {
    expect(replaceMarkedBlock('', block)).toBe(block);
  });

  it('replaces only the existing marked section', () => {
    const body = `Intro\n\n${MARKER_START}\nold media\n${MARKER_END}\n\nFooter\n`;
    expect(replaceMarkedBlock(body, block)).toBe(`Intro\n\n${block.trim()}\n\nFooter\n`);
  });

  it('is idempotent', () => {
    const once = replaceMarkedBlock('Intro', block);
    expect(replaceMarkedBlock(once, block)).toBe(once);
  });

  it('rejects incomplete markers', () => {
    expect(() => replaceMarkedBlock(`${MARKER_START}\nold`, block)).toThrow(/incomplete/);
    expect(() => replaceMarkedBlock(`old\n${MARKER_END}`, block)).toThrow(/incomplete/);
  });

  it('rejects multiple marked sections', () => {
    const body = `${block}\n${block}`;
    expect(() => replaceMarkedBlock(body, block)).toThrow(/multiple/);
  });

  it('rejects duplicate end markers', () => {
    const body = `${block}${MARKER_END}\n`;
    expect(() => replaceMarkedBlock(body, block)).toThrow(/multiple/);
  });
});

describe('format.mjs CLI', () => {
  function fixture() {
    const cwd = mkdtempSync(join(tmpdir(), 'before-and-after-'));
    mkdirSync(join(cwd, 'captures'));
    for (const file of ['before.png', 'after.png', 'preview.webm']) {
      writeFileSync(join(cwd, 'captures', file), file);
    }
    return cwd;
  }

  it('formats existing files and emits attachment paths', () => {
    const cwd = fixture();
    const script = join(process.cwd(), 'skill/scripts/format.mjs');
    const args = ['--before', 'captures/before.png', '--after', 'captures/after.png'];

    const markdown = execFileSync('node', [script, ...args], { cwd, encoding: 'utf8' });
    const attachments = execFileSync('node', [script, '--attach-list', ...args], { cwd, encoding: 'utf8' });

    expect(markdown).toContain('![Before](./captures/before.png)');
    expect(attachments).toBe('./captures/before.png\n./captures/after.png\n');
  });

  it('splices a block into a PR body file', () => {
    const cwd = fixture();
    const script = join(process.cwd(), 'skill/scripts/format.mjs');
    writeFileSync(join(cwd, 'body.md'), 'Keep this prose.\n');
    const output = execFileSync('node', [script, '--body-file', 'body.md', '--after', 'captures/preview.webm'], {
      cwd,
      encoding: 'utf8',
    });
    expect(output).toContain('Keep this prose.');
    expect(output).toContain('**Preview**');
  });

  it('fails for missing files', () => {
    const cwd = fixture();
    const script = join(process.cwd(), 'skill/scripts/format.mjs');
    const result = spawnSync('node', [script, '--after', 'captures/missing.png'], { cwd, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Media file does not exist');
  });

  it('fails for unsupported files', () => {
    const cwd = fixture();
    const script = join(process.cwd(), 'skill/scripts/format.mjs');
    writeFileSync(join(cwd, 'captures', 'after.svg'), '<svg/>');
    const result = spawnSync('node', [script, '--after', 'captures/after.svg'], { cwd, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unsupported media file');
  });
});
