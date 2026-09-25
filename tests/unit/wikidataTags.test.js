import { describe, expect, it } from 'vitest';
import {
  addFacts, addParents, ancestors, factsQuery, orgTags, parentsQuery, subjectTags, tagsForDoc, SUBJECT_DEPTH
} from '../../src/services/wikidataTags.js';

const uri = id => ({ value: `http://www.wikidata.org/entity/${id}` });

describe('queries', () => {
  it('ask for direct parents of a batch, dropping anything that is not an item id', () => {
    expect(parentsQuery(['Q1', 'Q2', 'bad"}'], 'wdt:P31|wdt:P279'))
      .toBe('SELECT ?item ?parent WHERE { VALUES ?item { wd:Q1 wd:Q2 } ?item wdt:P31|wdt:P279 ?parent . }');
    expect(factsQuery(['Q5'])).toContain('VALUES ?item { wd:Q5 } VALUES ?prop { wdt:P53 wdt:P39 wdt:P17 wdt:P27 }');
  });
});

describe('addParents and addFacts', () => {
  it('build maps from SPARQL rows and skip odd values', () => {
    const parents = addParents({}, { results: { bindings: [
      { item: uri('Q1'), parent: uri('Q2') }, { item: uri('Q1'), parent: uri('Q2') },
      { item: uri('Q1'), parent: uri('Q3') }, { item: uri('Q1'), parent: { value: 'http://example.org/x' } }
    ] } });
    expect(parents).toEqual({ Q1: ['Q2', 'Q3'] });
    const facts = addFacts({}, { results: { bindings: [{ item: uri('Q5'), p: { value: 'P53' }, v: uri('Q101978') }] } });
    expect(facts).toEqual({ Q5: [['P53', 'Q101978']] });
  });
});

describe('ancestors', () => {
  const parents = { A: ['B'], B: ['C', 'A'], C: ['D'], D: ['E'], E: ['F'] };
  it('climbs a limited number of levels and survives loops', () => {
    expect([...ancestors('A', parents, 2)].sort()).toEqual(['A', 'B', 'C']);
    expect(ancestors('A', parents, 10).has('F')).toBe(true);
  });
});

describe('subjectTags', () => {
  it('finds topics and shortcuts through parts and classes', () => {
    // Battle of Gettysburg -> part of American Civil War -> instance of civil war -> subclass of war
    const parents = { Q100: ['Q8676'], Q8676: ['Q300'], Q300: ['Q198'] };
    expect(subjectTags('Q100', parents, {})).toEqual(['american-civil-war', 'history']);
  });

  it('stops at the depth limit', () => {
    const chain = { Q1: ['Q2'], Q2: ['Q3'], Q3: ['Q4'], Q4: ['Q5'], Q5: ['Q198'] };
    expect(SUBJECT_DEPTH).toBe(4);
    expect(subjectTags('Q1', chain, {})).toEqual([]);
  });

  it('gives war History and war only, even when it also reaches a social root', () => {
    expect(subjectTags('Q1', { Q1: ['Q198', 'Q1920219'] }, {})).toEqual(['history']);
    expect(subjectTags('Q2', { Q2: ['Q1920219'] }, {})).toEqual(['society']);
  });

  it('tags royals and British people and places from facts', () => {
    expect(subjectTags('Q1', {}, { Q1: [['P53', 'Q101978']] })).toEqual(['monarchy']);
    expect(subjectTags('Q2', {}, { Q2: [['P39', 'Q18810062']] })).toEqual(['monarchy']);
    expect(subjectTags('Q3', {}, { Q3: [['P27', 'Q25']] })).toEqual(['britain']);
    expect(subjectTags('Q4', {}, { Q4: [['P17', 'Q30']] })).toEqual([]);
  });
});

describe('orgTags', () => {
  it('finds the broadcaster through parent organisations', () => {
    expect(orgTags('Q787211', { Q787211: ['Q9531'] })).toEqual(['maker:bbc']);
    expect(orgTags('Q1', { Q1: ['Q2'], Q2: ['Q215616'] })).toEqual(['maker:pbs']);
    expect(orgTags('Q3', {})).toEqual([]);
  });
});

describe('tagsForDoc', () => {
  const lookup = { S1: ['english-civil-war', 'history'], S2: ['monarchy'], O1: ['maker:history'], S3: ['maker:bbc'] };

  it('combines genres, subjects and organisations', () => {
    expect(tagsForDoc({ genres: ['Q842256'], subjectIds: [], orgs: ['O1'] }, lookup))
      .toEqual({ topics: ['society'], shortcuts: [], makers: ['history'] });
  });

  it('lets a shortcut imply its topics', () => {
    expect(tagsForDoc({ subjectIds: ['S1'] }, lookup)).toEqual({ topics: ['history', 'britain'], shortcuts: ['english-civil-war'], makers: [] });
    expect(tagsForDoc({ subjectIds: ['S2'] }, lookup)).toEqual({ topics: ['britain'], shortcuts: ['monarchy'], makers: [] });
  });

  it('takes makers only from organisations and leaves country of origin to the app', () => {
    expect(tagsForDoc({ subjectIds: ['S3'], countries: ['Q145'] }, lookup)).toEqual({ topics: [], shortcuts: [], makers: [] });
  });
});
