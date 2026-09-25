import { describe, expect, it } from 'vitest';
import { QUERY, isFiction, parseBindings } from '../../src/services/wikidataQuery.js';

const row = (qid, title, genres = '') => ({
  film: { value: `http://www.wikidata.org/entity/${qid}` },
  title: { value: title },
  released: { value: '2010-01-01T00:00:00Z' },
  genres: { value: genres }
});

describe('isFiction', () => {
  it.each([
    [['Q93204', 'Q622370'], true, 'docudrama'],
    [['Q93204', 'Q472637'], true, 'docufiction'],
    [['Q93204', 'Q459435'], true, 'mockumentary'],
    [['Q93204', 'Q644437'], true, 'snuff film'],
    [['Q93204', 'Q130232', 'Q959790', 'Q2484376'], true, 'drama, crime and thriller'],
    [['Q93204', 'Q130232', 'Q959790'], false, 'two fiction genres'],
    [['Q93204', 'Q369747', 'Q130232'], false, 'war film does not count as fiction'],
    [['Q93204'], false, 'documentary only'],
    [[], false, 'no genres']
  ])('%j is fiction: %s (%s)', (genres, expected) => {
    expect(isFiction(genres)).toBe(expected);
  });
});

describe('parseBindings', () => {
  it('drops fiction and blocklisted items, then ranks what is left in order', () => {
    const docs = parseBindings({
      results: {
        bindings: [
          row('Q206388', 'Once Upon a Time in America', 'Q93204|Q130232|Q188473|Q959790|Q2484376'),
          row('Q1', 'Real Documentary', 'Q93204|Q369747'),
          row('Q1156089', 'Soul Surfer', 'Q93204|Q130232'),
          row('Q2', 'Another Documentary', 'Q93204')
        ]
      }
    });
    expect(docs.map(d => [d.title, d.rank])).toEqual([['Real Documentary', 0], ['Another Documentary', 1]]);
    expect(docs[0].genres).toEqual(['Q93204', 'Q369747']);
  });
});

describe('QUERY', () => {
  it('converts durations from seconds and hours and skips deprecated values', () => {
    expect(QUERY).toContain('wikibase:quantityUnit ?durUnit');
    expect(QUERY).toContain('IF(?durUnit = wd:Q11574, ?durAmount / 60, IF(?durUnit = wd:Q25235, ?durAmount * 60, ?durAmount))');
    expect(QUERY).toContain('FILTER(?durRank != wikibase:DeprecatedRank)');
    // Several cuts can be listed. MAX keeps the choice stable between builds.
    expect(QUERY).toContain('(MAX(?dur) AS ?minutes)');
  });

  it('asks for genres and allows up to 5,000 titles', () => {
    expect(QUERY).toContain('AS ?genres');
    expect(QUERY).toMatch(/LIMIT 5000`?$/);
  });
});
