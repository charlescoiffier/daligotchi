/**
 * Simulateur en ligne de commande.
 *
 *   pnpm simulate                                   2 visites par jour pendant toute une vie
 *   pnpm simulate --visites 1 --jours 30            1 visite par jour pendant 30 jours
 *   pnpm simulate --absence 40:10                   absence de 10 jours à partir du jour 40
 *   pnpm simulate --longevite 1.1                   animal qui vit 10 % plus longtemps
 *   pnpm simulate --detail                          toutes les visites, pas seulement la première du jour
 */
import { parseArgs } from 'node:util';
import { type SimulationOptions, simulate, t } from '../src/index.ts';

const { values } = parseArgs({
  options: {
    jours: { type: 'string', default: '125' },
    visites: { type: 'string', default: '2' },
    absence: { type: 'string', multiple: true, default: [] },
    longevite: { type: 'string', default: '1' },
    detail: { type: 'boolean', default: false },
  },
});

const visitsPerDay = Number(values.visites);
if (visitsPerDay !== 0 && visitsPerDay !== 1 && visitsPerDay !== 2) {
  console.error('--visites doit valoir 0, 1 ou 2');
  process.exit(1);
}

const absences = values.absence.map((value) => {
  const [fromDay, days] = value.split(':').map(Number);
  if (!Number.isInteger(fromDay) || !Number.isInteger(days)) {
    console.error(`--absence attend jour:durée (ex. 40:10), reçu « ${value} »`);
    process.exit(1);
  }
  return { fromDay: fromDay!, days: days! };
});

const options: SimulationOptions = {
  days: Number(values.jours),
  visitsPerDay,
  absences,
  longevityFactor: Number(values.longevite),
};

const report = simulate(options);

console.log(
  `Simulation : ${options.days} jours, ${visitsPerDay} visite(s) par jour` +
    (absences.length ? `, absences : ${absences.map((a) => `jours ${a.fromDay}–${a.fromDay + a.days - 1}`).join(', ')}` : '') +
    '\nÉtat constaté en arrivant, avant les soins.\n',
);

const shownDays = new Set<number>();
for (const visit of report.visits) {
  if (!values.detail && shownDays.has(visit.day)) continue;
  shownDays.add(visit.day);
  const d = visit.description;
  const needs = Object.values(d.needs).map((key) => t(key)).join(' · ');
  const elder = d.elderSigns ? ` · ${t('elder.signs')}` : '';
  console.log(
    `J${String(visit.day).padStart(3)} ${String(visit.hour).padStart(2)}h  ${t(d.stage).padEnd(6)}  ${t(d.emotion).padEnd(10)}  ${needs} · ${t(visit.home)}${elder}`,
  );
}

console.log('\nÉvénements :');
for (const event of report.events) {
  console.log(`  jour ${event.day} : ${t(event.key)}`);
}
if (report.events.length === 0) console.log('  aucun');
