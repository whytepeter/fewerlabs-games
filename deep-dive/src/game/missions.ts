import { missions, type MissionDef } from '../core/meta';

/**
 * Deep Dive mission templates. Stats reported at the end of each dive:
 *   depth, pearls, air, perks, cleanDepth (metres before the first lost life),
 *   anglers (anglers dodged), eels (eels slipped past), closeCalls (creatures passed with very little room),
 *   specials (diver special moves used)
 */
const POOL: MissionDef[] = [
  { id: 'depth',     text: 'Dive {n} m in one dive',           stat: 'depth',      kind: 'run',   targets: [200, 450, 800, 1200, 1700], reward: 30 },
  { id: 'clean',     text: 'Reach {n} m without losing a life', stat: 'cleanDepth', kind: 'run',   targets: [150, 350, 650, 1000],       reward: 40 },
  { id: 'pearlsRun', text: 'Collect {n} pearls in one dive',    stat: 'pearls',     kind: 'run',   targets: [10, 25, 45, 70],            reward: 30 },
  { id: 'pearls',    text: 'Collect {n} pearls in total',       stat: 'pearls',     kind: 'total', targets: [60, 200, 500, 1200],        reward: 35 },
  { id: 'air',       text: 'Grab {n} air bubbles in one dive',  stat: 'air',        kind: 'run',   targets: [15, 30, 50],                reward: 25 },
  { id: 'perks',     text: 'Pick up {n} power-ups',             stat: 'perks',      kind: 'total', targets: [3, 10, 25],                 reward: 35 },
  { id: 'anglers',   text: 'Dodge {n} anglerfish',              stat: 'anglers',    kind: 'total', targets: [10, 35, 90],                reward: 35 },
  { id: 'close',     text: 'Have {n} close calls in one dive',   stat: 'closeCalls', kind: 'run',   targets: [3, 8, 15, 25],              reward: 35 },
  { id: 'eels',      text: 'Slip past {n} electric eels',       stat: 'eels',       kind: 'total', targets: [5, 20, 50],                 reward: 40 },
  { id: 'specials',  text: 'Use your diver’s special {n} times', stat: 'specials', kind: 'total', targets: [3, 10, 25],             reward: 35 },
];

export const deepMissions = missions('deep-dive', POOL);
