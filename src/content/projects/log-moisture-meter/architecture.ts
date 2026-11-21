import type { Architecture } from '../../../lib/diagram';

const arch: Architecture = {
  description:
    'Log moisture meter. A T1000 radar sits on the cut face of a log and sends its waveform to a Visual Basic app. ' +
    'The app is calibrated with a pulse through air and applies a species model to give a moisture reading. ' +
    'The yard foreman uses the reading to ship the log or leave it to dry, and sends his data back so the models can be retrained. ' +
    'Before, moisture was measured by cutting a slice off the log, weighing it, drying it in an oven for 24 to 48 hours and weighing it again.',

  before: {
    label: 'Oven test',
    nodes: [
      { id: 'log', label: 'Log', sub: 'drying in the yard', kind: 'external', x: 0, y: 0, detail: 'oven' },
      { id: 'cookie', label: 'Cut a cookie', sub: '2 to 3 inch slice', kind: 'service', x: 1, y: 0, detail: 'oven' },
      { id: 'wet', label: 'Weigh it', sub: 'wet weight', kind: 'service', x: 2, y: 0, detail: 'oven' },
      { id: 'oven', label: 'Oven', sub: '24 to 48 hours', kind: 'service', x: 3, y: 0, detail: 'oven' },
      { id: 'dryw', label: 'Weigh again', sub: 'dry weight', kind: 'service', x: 3, y: 1, detail: 'oven' },
      { id: 'foreman', label: 'Yard foreman', sub: 'a day or two later', kind: 'client', x: 2, y: 1, detail: 'oven' },
    ],
    edges: [
      { from: 'log', to: 'cookie' },
      { from: 'cookie', to: 'wet' },
      { from: 'wet', to: 'oven' },
      { from: 'oven', to: 'dryw' },
      { from: 'dryw', to: 'foreman', label: 'moisture %' },
    ],
  },

  after: {
    label: 'Radar meter',
    nodes: [
      { id: 'log', label: 'Log or cookie', sub: 'cut face', kind: 'external', x: 0, y: 0, detail: 'radar' },
      { id: 'radar', label: 'T1000 radar', sub: 'Sensors & Software', kind: 'service', x: 1, y: 0, detail: 'radar' },
      { id: 'app', label: 'Meter app', sub: 'Visual Basic', kind: 'service', x: 2, y: 0, detail: 'app' },
      { id: 'foreman', label: 'Yard foreman', sub: 'reading on the spot', kind: 'client', x: 3, y: 0, detail: 'app' },
      { id: 'ship', label: 'Ship it', sub: 'dry enough', kind: 'external', x: 4, y: 0, detail: 'app' },
      { id: 'dry', label: 'Keep drying', kind: 'external', x: 4, y: 1, detail: 'app' },
      { id: 'air', label: 'Air pulse', sub: 'before each batch', kind: 'config', x: 1, y: 1, detail: 'calibration' },
      { id: 'models', label: 'Species models', sub: 'PLSR weights', kind: 'config', x: 2, y: 1, detail: 'species' },
      { id: 'plsr', label: 'PLSR training', sub: 'per species', kind: 'service', x: 2, y: 2, detail: 'plsr' },
      { id: 'samples', label: 'Labelled samples', sub: 'waveform + oven result', kind: 'store', x: 3, y: 2, detail: 'feedback' },
    ],
    edges: [
      { from: 'log', to: 'radar' },
      { from: 'radar', to: 'app' },
      { from: 'app', to: 'foreman' },
      { from: 'foreman', to: 'ship' },
      { from: 'foreman', to: 'dry' },
      { from: 'air', to: 'radar', style: 'dashed', label: 'calibrate' },
      { from: 'models', to: 'app', style: 'dashed' },
      { from: 'foreman', to: 'samples', label: 'sends data' },
      { from: 'samples', to: 'plsr' },
      { from: 'plsr', to: 'models', label: 'retrain' },
    ],
  },

  flows: [
    {
      label: 'Measure a log',
      steps: [
        { edges: [['air', 'radar']], note: 'Before each batch, the radar fires a pulse through air so the app knows where a wave starts.' },
        { edges: [['log', 'radar']], note: 'The radar sits flat on the cut face of the log and sends a pulse through the wood.' },
        { edges: [['radar', 'app']], note: 'The app records the waveform that comes back.' },
        { edges: [['models', 'app']], note: 'It multiplies the waveform by the weights of the model for that species (a dot product).' },
        { edges: [['app', 'foreman']], note: 'The foreman gets a moisture reading straight away, not a day or two later.' },
        { edges: [['foreman', 'ship'], ['foreman', 'dry']], note: 'He decides whether the log is dry enough to truck out or needs more time.' },
        { edges: [['foreman', 'samples']], note: 'He sends all of his data back to me.' },
        { edges: [['samples', 'plsr'], ['plsr', 'models']], note: 'I add it to the training set and retrain the species models, so the next reading is a little better.' },
      ],
    },
  ],
};

export default arch;
