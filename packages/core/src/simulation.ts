import {
  type AnimalDescription,
  advanceHousehold,
  applyAnimalAction,
  applyHouseholdAction,
  describeAnimal,
  describeHome,
  type HouseholdState,
  newbornAnimal,
} from './animal.ts';
import { DAY, HOUR } from './clock.ts';
import type { MessageKey } from './i18n/index.ts';
import { hasElderSigns, isLifeOver, stageOf } from './lifecycle.ts';
import { needLevel } from './needs.ts';

/**
 * Simulateur : fait vivre un animal pendant des jours de jeu, avec un joueur qui passe
 * à heures fixes. Sert à vérifier l'équilibrage sans attendre quatre mois.
 */
export interface SimulationOptions {
  days: number;
  visitsPerDay: 0 | 1 | 2;
  /** Périodes sans aucune visite. */
  absences?: readonly { fromDay: number; days: number }[];
  longevityFactor?: number;
}

export interface VisitReport {
  day: number;
  hour: number;
  /** État constaté en arrivant, avant les soins. */
  description: AnimalDescription;
  home: MessageKey;
}

export interface SimulationEvent {
  day: number;
  key: MessageKey;
}

export interface SimulationReport {
  visits: VisitReport[];
  events: SimulationEvent[];
}

const VISIT_HOURS: Record<SimulationOptions['visitsPerDay'], readonly number[]> = {
  0: [],
  1: [18],
  2: [8, 19],
};

function isAbsent(day: number, absences: SimulationOptions['absences'] = []): boolean {
  return absences.some((absence) => day >= absence.fromDay && day < absence.fromDay + absence.days);
}

/** Un joueur attentif : il nourrit, abreuve, nettoie, caresse, joue et lave si besoin. */
function careFor(household: HouseholdState): HouseholdState {
  let next = applyHouseholdAction(household, 'feed');
  next = applyHouseholdAction(next, 'water');
  next = applyHouseholdAction(next, 'cleanHome');
  return {
    ...next,
    animals: next.animals.map((animal) => {
      let needs = applyAnimalAction(animal.needs, 'pet');
      needs = applyAnimalAction(needs, 'ball');
      if (needLevel(needs.hygiene) !== 'good') needs = applyAnimalAction(needs, 'wash');
      return { ...animal, needs };
    }),
  };
}

export function simulate(options: SimulationOptions): SimulationReport {
  const visitHours = VISIT_HOURS[options.visitsPerDay];
  const visits: VisitReport[] = [];
  const events: SimulationEvent[] = [];

  let household: HouseholdState = {
    homeCleanliness: 100,
    animals: [newbornAnimal(0, options.longevityFactor)],
    at: 0,
    lastVisitAt: 0,
  };
  let previous = { stage: 'young', elderSigns: false };

  for (let hourIndex = 1; hourIndex <= options.days * 24; hourIndex++) {
    const now = hourIndex * HOUR;
    const day = Math.floor(now / DAY);
    const hour = (now % DAY) / HOUR;

    household = advanceHousehold(household, now);
    const animal = household.animals[0]!;

    const stage = stageOf(animal.ageMs);
    if (stage !== previous.stage) events.push({ day, key: `event.${stage}` as MessageKey });
    const elderSigns = hasElderSigns(animal.ageMs, animal.lifespanMs);
    if (elderSigns && !previous.elderSigns) events.push({ day, key: 'event.elderSigns' });
    previous = { stage, elderSigns };

    if (isLifeOver(animal.ageMs, animal.lifespanMs)) {
      events.push({ day, key: 'event.lifeOver' });
      break;
    }

    if (visitHours.includes(hour) && !isAbsent(day, options.absences)) {
      visits.push({
        day,
        hour,
        description: describeAnimal(animal, household.homeCleanliness),
        home: describeHome(household.homeCleanliness),
      });
      household = { ...careFor(household), lastVisitAt: now };
    }
  }

  return { visits, events };
}
