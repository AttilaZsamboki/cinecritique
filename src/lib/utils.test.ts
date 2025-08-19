import { describe, it, expect } from 'vitest';
import { toYouTubeEmbedUrl } from './utils';

describe('toYouTubeEmbedUrl', () => {
  it('returns null for invalid input', () => {
    expect(toYouTubeEmbedUrl(undefined)).toBeNull();
    expect(toYouTubeEmbedUrl('notaurl')).toBeNull();
  });

  it('parses youtu.be short urls', () => {
    const url = toYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(url).toContain('/embed/dQw4w9WgXcQ?');
  });

  it('parses youtube watch urls with start time', () => {
    const url = toYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s');
    expect(url).toContain('/embed/dQw4w9WgXcQ?');
    expect(url).toContain('start=65');
  });

  it('parses shorts and embed routes', () => {
    expect(toYouTubeEmbedUrl('https://youtube.com/shorts/abc123')).toContain('/embed/abc123?');
    expect(toYouTubeEmbedUrl('https://youtube.com/embed/xyz987')).toContain('/embed/xyz987?');
  });
});
