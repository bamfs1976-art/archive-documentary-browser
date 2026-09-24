import { describe, expect, it } from 'vitest';
import { classify, topicLabel, TOPICS } from '../../src/services/topics.js';

const doc = fields => ({ title: '', description: '', subjects: [], countries: [], ...fields });

describe('topicLabel', () => {
  it('returns the label for a known topic and empty text otherwise', () => {
    expect(topicLabel('britain')).toBe('Wales and Britain');
    expect(topicLabel('nope')).toBe('');
    expect(TOPICS.map(t => t.id)).toEqual(['all', 'history', 'society', 'britain']);
  });
});

describe('classify', () => {
  it('puts British countries of origin in Wales and Britain', () => {
    for (const code of ['Q145', 'Q25', 'Q21', 'Q22', 'Q26']) {
      expect(classify(doc({ countries: [code] }))).toEqual(['britain']);
    }
  });

  it('ignores other countries', () => {
    expect(classify(doc({ countries: ['Q30'] }))).toEqual([]);
  });

  it('matches keywords in the title, description and subjects', () => {
    expect(classify(doc({ title: 'Swansea Love Story' }))).toEqual(['britain']);
    expect(classify(doc({ description: '2003 film about the Iraq War' }))).toEqual(['history']);
    expect(classify(doc({ subjects: ['racism'] }))).toEqual(['society']);
  });

  it('returns several topics in a fixed order', () => {
    expect(classify(doc({ description: 'British soldiers and their family life' }))).toEqual(['britain', 'history', 'society']);
  });

  it('matches whole words only', () => {
    expect(classify(doc({ title: 'Warriors of the Wasteland' }))).toEqual([]);
    expect(classify(doc({ title: 'Startup Nation' }))).toEqual([]);
    expect(classify(doc({ title: 'Classic Albums' }))).toEqual([]);
  });

  it('ignores case', () => {
    expect(classify(doc({ title: 'WALES' }))).toEqual(['britain']);
  });

  it('returns nothing for an unrelated title', () => {
    expect(classify(doc({ title: 'March of the Penguins', description: 'nature documentary' }))).toEqual([]);
  });
});
