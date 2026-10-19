import { describe, expect, it } from 'vitest';
import { simulate } from '../src/simulation.ts';

function levelsSeen(report: ReturnType<typeof simulate>, need: string) {
  return new Set(report.visits.map((visit) => visit.description.needs[need as 'satiety']));
}

describe('simulate', () => {
  it('deux visites par jour gardent l’animal en forme et heureux', () => {
    const report = simulate({ days: 30, visitsPerDay: 2 });
    for (const visit of report.visits) {
      expect(Object.values(visit.description.needs).some((key) => key.endsWith('.bad'))).toBe(false);
      expect(visit.description.emotion).not.toBe('emotion.sad');
    }
  });

  it('une seule visite par jour laisse l’animal correct mais pas épanoui', () => {
    const report = simulate({ days: 30, visitsPerDay: 1 });
    const satiety = levelsSeen(report, 'satiety');
    expect(satiety.has('need.satiety.low')).toBe(true);
    expect(satiety.has('need.satiety.bad')).toBe(false);
  });

  it('parcourt toute une vie : adulte au jour 28, vieux au jour 91, fin de vie au jour 119', () => {
    const report = simulate({ days: 125, visitsPerDay: 2 });
    const dayOf = (key: string) => report.events.find((event) => event.key === key)?.day;
    expect(dayOf('event.adult')).toBe(28);
    expect(dayOf('event.old')).toBe(91);
    expect(dayOf('event.elderSigns')).toBe(116);
    expect(dayOf('event.lifeOver')).toBe(119);
  });

  it('une absence de 10 jours retarde la fin de vie de 4 jours', () => {
    const report = simulate({ days: 130, visitsPerDay: 2, absences: [{ fromDay: 40, days: 10 }] });
    expect(report.events.find((event) => event.key === 'event.lifeOver')?.day).toBe(123);
  });

  it('au retour d’une longue absence, l’animal est affamé mais vivant', () => {
    const report = simulate({ days: 60, visitsPerDay: 2, absences: [{ fromDay: 40, days: 10 }] });
    const firstVisitBack = report.visits.find((visit) => visit.day === 50);
    expect(firstVisitBack?.description.needs.satiety).toBe('need.satiety.bad');
    expect(report.events.some((event) => event.key === 'event.lifeOver')).toBe(false);
  });
});
