// Small static diagrams shown at the top of each Detail block on the log moisture meter page.
import type { Architecture, DiagramEdge, DiagramGroup, DiagramNode } from '../../../lib/diagram';

const still = (description: string, nodes: DiagramNode[], edges: DiagramEdge[], groups?: DiagramGroup[]): Architecture =>
  ({ description, after: { label: description, nodes, edges, groups } });

export const oven = still(
  'The oven test: cut a slice off the log, weigh it, dry it for 24 to 48 hours, weigh it again. The lost weight is water.',
  [
    { id: 'cookie', label: 'Cut a cookie', sub: '2 to 3 inch slice', kind: 'service', x: 0, y: 0 },
    { id: 'wet', label: 'Weigh it', sub: 'wet weight', kind: 'service', x: 1, y: 0 },
    { id: 'oven', label: 'Oven', sub: '24 to 48 hours', kind: 'service', x: 2, y: 0 },
    { id: 'dry', label: 'Weigh again', sub: 'dry weight', kind: 'service', x: 3, y: 0 },
  ],
  [
    { from: 'cookie', to: 'wet' },
    { from: 'wet', to: 'oven' },
    { from: 'oven', to: 'dry' },
  ],
);

export const calibration = still(
  'Calibration: a pulse through air gives the first break, where the wave reaches 7 mV. Every measurement in the batch is lined up against it.',
  [
    { id: 'air', label: 'Air pulse', sub: 'peaks at 50 mV', kind: 'config', x: 0, y: 0 },
    { id: 'fb', label: 'First break', sub: 'wave reaches 7 mV', kind: 'service', x: 1, y: 0 },
    { id: 'batch', label: 'Batch of readings', sub: 'lined up to it', kind: 'service', x: 2, y: 0 },
  ],
  [
    { from: 'air', to: 'fb' },
    { from: 'fb', to: 'batch' },
    { from: 'batch', to: 'air', label: 'every hour', style: 'dashed', via: [[2, 1], [0, 1]] },
  ],
);

export const plsr = still(
  'A reading is the dot product of the waveform from the radar and the weights from the species model.',
  [
    { id: 'wave', label: 'Waveform', sub: 'from the radar', kind: 'service', x: 0, y: 0 },
    { id: 'weights', label: 'Weights', sub: 'from PLSR', kind: 'config', x: 0, y: 1 },
    { id: 'dot', label: 'Dot product', kind: 'service', x: 1, y: 0.5 },
    { id: 'mc', label: 'Moisture %', kind: 'client', x: 2, y: 0.5 },
  ],
  [
    { from: 'wave', to: 'dot' },
    { from: 'weights', to: 'dot' },
    { from: 'dot', to: 'mc' },
  ],
);

export const species = still(
  'The operator picks the model for the species being measured, or the combined model when the species is unknown.',
  [
    { id: 'pick', label: 'Pick a species', sub: 'in the app', kind: 'client', x: 0, y: 1.5 },
    { id: 'spruce', label: 'Spruce', kind: 'config', x: 1, y: 0 },
    { id: 'aspen', label: 'Aspen', kind: 'config', x: 1, y: 1 },
    { id: 'fir', label: 'Douglas Fir', kind: 'config', x: 1, y: 2 },
    { id: 'all', label: 'All species', sub: 'when unknown', kind: 'config', x: 1, y: 3 },
  ],
  [
    { from: 'pick', to: 'spruce' },
    { from: 'pick', to: 'aspen' },
    { from: 'pick', to: 'fir' },
    { from: 'pick', to: 'all', style: 'dashed' },
  ],
  [{ label: 'About 30% more accurate', x: 1, y: 0, w: 1, h: 3 }],
);

export const app = still(
  'The app drives the radar, handles calibration and species models, and gives the foreman a reading he uses to ship a log or leave it to dry.',
  [
    { id: 'radar', label: 'T1000 radar', kind: 'service', x: 0, y: 0.5 },
    { id: 'app', label: 'Meter app', sub: 'calibrate, pick, record', kind: 'service', x: 1, y: 0.5 },
    { id: 'foreman', label: 'Yard foreman', kind: 'client', x: 2, y: 0.5 },
    { id: 'ship', label: 'Ship it', kind: 'external', x: 3, y: 0 },
    { id: 'dry', label: 'Keep drying', kind: 'external', x: 3, y: 1 },
  ],
  [
    { from: 'radar', to: 'app' },
    { from: 'app', to: 'foreman', label: 'moisture %' },
    { from: 'foreman', to: 'ship' },
    { from: 'foreman', to: 'dry' },
  ],
);

export const feedback = still(
  'The loop: the foreman sends his data, I add it to the training set and retrain, and new models go back to the yard.',
  [
    { id: 'yard', label: 'Yard foreman', sub: 'takes readings', kind: 'client', x: 0, y: 0 },
    { id: 'samples', label: 'Training set', sub: 'grows each batch', kind: 'store', x: 1, y: 0 },
    { id: 'plsr', label: 'Retrain', sub: 'PLSR per species', kind: 'service', x: 2, y: 0 },
    { id: 'models', label: 'Species models', kind: 'config', x: 1, y: 1 },
  ],
  [
    { from: 'yard', to: 'samples', label: 'sends data' },
    { from: 'samples', to: 'plsr' },
    { from: 'plsr', to: 'models' },
    { from: 'models', to: 'yard', label: 'better readings' },
  ],
);
