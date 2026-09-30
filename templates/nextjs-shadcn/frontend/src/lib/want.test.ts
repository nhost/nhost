import { describe, expect, it } from 'vitest';
import { asPreposition, wantPhrase, wantSentence } from '@/lib/want';

describe('asPreposition', () => {
  it('keeps the words the UI offers', () => {
    expect(asPreposition('in')).toBe('in');
    expect(asPreposition('from')).toBe('from');
  });

  // The column is plain text with no check constraint, so anything can arrive:
  // a row written before the column existed, by the dashboard, or by something
  // that is not this app.
  it('falls back to "in" for anything it does not offer', () => {
    expect(asPreposition(null)).toBe('in');
    expect(asPreposition(undefined)).toBe('in');
    expect(asPreposition('')).toBe('in');
    expect(asPreposition('At')).toBe('in');
    expect(asPreposition('beside')).toBe('in');
    expect(asPreposition('on')).toBe('in');
  });
});

describe('wantPhrase', () => {
  it('reads as a sentence when there is a location', () => {
    expect(
      wantPhrase({
        title: 'go skateboarding',
        preposition: 'in',
        location: 'Los Angeles, California',
      }),
    ).toBe('go skateboarding in Los Angeles, California');
  });

  // The location is the optional half. Without one the preposition has nothing
  // to join, so it has to disappear rather than leave a dangling "in".
  it('drops the preposition when there is no location', () => {
    const want = { title: 'learn to make sourdough', preposition: 'in' };

    expect(wantPhrase({ ...want, location: null })).toBe(
      'learn to make sourdough',
    );
    expect(wantPhrase({ ...want, location: '' })).toBe(
      'learn to make sourdough',
    );
    expect(wantPhrase({ ...want, location: '   ' })).toBe(
      'learn to make sourdough',
    );
  });

  it('trims a padded location', () => {
    expect(
      wantPhrase({ title: 'ski', preposition: 'at', location: '  Niseko  ' }),
    ).toBe('ski at Niseko');
  });

  // A row can hold a word the UI no longer offers; the sentence still has to
  // read properly rather than print it.
  it('normalises an unknown preposition rather than printing it', () => {
    expect(
      wantPhrase({
        title: 'go skateboarding',
        preposition: 'beside',
        location: 'the river',
      }),
    ).toBe('go skateboarding in the river');
  });
});

describe('wantSentence', () => {
  it('adds the opening the list shows in front of every row', () => {
    expect(
      wantSentence({ title: 'ski', preposition: 'at', location: 'Niseko' }),
    ).toBe('I want to ski at Niseko');
  });
});
