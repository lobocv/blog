import type { Architecture, DiagramEdge, DiagramNode } from '../../../lib/diagram';

// One copy of the pipeline per social network, which is the point of the "before" view
const lanes = [
  { key: 'fb', name: 'Facebook', y: 0 },
  { key: 'tw', name: 'Twitter', y: 1 },
  { key: 'li', name: 'LinkedIn', y: 2 },
];
const stages = [
  { id: 'tag', label: 'Auto-tagging' },
  { id: 'attr', label: 'Web attribution' },
  { id: 'roi', label: 'ROI' },
];
const laneNodes: DiagramNode[] = lanes.flatMap(l => [
  // The first lane's Collector shares its id with the "after" view, so it glides between them
  { id: l.key === 'fb' ? 'collectors' : `col-${l.key}`, label: 'Collector', sub: 'scraper', kind: 'service', x: 0, y: l.y, detail: 'parallel' },
  ...stages.map((s, i): DiagramNode => ({ id: `${s.id}-${l.key}`, label: s.label, sub: 'writes Mongo, then ES', kind: 'service', x: i + 1, y: l.y, detail: 'pipeline' })),
]);
const laneEdges: DiagramEdge[] = lanes.flatMap(l => {
  const ids = [l.key === 'fb' ? 'collectors' : `col-${l.key}`, ...stages.map(s => `${s.id}-${l.key}`)];
  const last = ids[ids.length - 1];
  return [
    ...ids.slice(1).map((to, i): DiagramEdge => ({ from: ids[i], to, ...(l.key === 'fb' && i === 0 ? { label: 'Kestrel' } : {}) })),
    { from: last, to: 'mongo', style: 'tangle' },
    { from: last, to: 'es', style: 'tangle' },
  ];
});

const arch: Architecture = {
  description:
    'Avalanche architecture. Collectors publish posts to a Kafka ingestion topic. Content and Metric services store them in MongoDB in one data model, ' +
    'using rules from a Social Platform Registry. A sharded change stream reader turns database changes into domain events on Kafka. ' +
    'An indexer copies changes into Elasticsearch, which the Hootsuite frontend reads. An event folder merges bursts of events before ' +
    'stream processors run aggregations and publish new events, which the Content service writes back.',

  before: {
    label: 'Before',
    groups: lanes.map(l => ({ label: `${l.name} pipeline`, x: 0, y: l.y, w: 4, h: 1, stack: l.key === 'li' })),
    nodes: [
      ...laneNodes,
      { id: 'mongo', label: 'MongoDB', sub: 'schema per network', kind: 'store', x: 4, y: 0.5, detail: 'model' },
      { id: 'es', label: 'Elasticsearch', sub: 'schema per network', kind: 'store', x: 4, y: 1.5, detail: 'cqrs' },
      { id: 'app', label: 'LiftMetrix app', sub: 'normalizes on read', kind: 'client', x: 5, y: 1, detail: 'model' },
    ],
    edges: [
      ...laneEdges,
      { from: 'mongo', to: 'app' },
      { from: 'es', to: 'app', label: 'reads' },
    ],
  },

  after: {
    label: 'Avalanche',
    nodes: [
      { id: 'networks', label: 'Social networks', sub: 'APIs', kind: 'external', x: 0, y: 0 },
      { id: 'collectors', label: 'Collectors', sub: 'scrapers', kind: 'service', x: 1, y: 0, detail: 'parallel' },
      { id: 'ingest', label: 'Ingestion topic', sub: 'Kafka', kind: 'queue', x: 2, y: 0, detail: 'events' },
      { id: 'metric', label: 'Metric service', kind: 'service', x: 3, y: 0, detail: 'model' },
      { id: 'mongo', label: 'MongoDB', sub: 'write side', kind: 'store', x: 4, y: 0, detail: 'model' },
      { id: 'csr', label: 'Change streams', sub: 'sharded reader', kind: 'service', x: 5, y: 0, detail: 'changestreams' },
      { id: 'spr', label: 'Platform Registry', sub: 'per-network rules', kind: 'config', x: 2, y: 1, detail: 'spr' },
      { id: 'content', label: 'Content service', kind: 'service', x: 3, y: 1, detail: 'model' },
      { id: 'events', label: 'Domain events', sub: 'Kafka', kind: 'queue', x: 5, y: 1, detail: 'events' },
      { id: 'frontend', label: 'Hootsuite Frontend', kind: 'client', x: 1, y: 2, detail: 'cqrs' },
      { id: 'es', label: 'Elasticsearch', sub: 'read side', kind: 'store', x: 2, y: 2, detail: 'cqrs' },
      { id: 'indexer', label: 'ES indexer', sub: 'subscriber', kind: 'service', x: 3, y: 2, detail: 'cqrs' },
      { id: 'procs', label: 'Stream processors', sub: 'aggregations', kind: 'service', x: 4, y: 2, detail: 'events' },
      { id: 'folder', label: 'Event folder', sub: 'Redis sorted sets', kind: 'service', x: 5, y: 2, detail: 'folding' },
    ],
    edges: [
      { from: 'networks', to: 'collectors' },
      { from: 'collectors', to: 'ingest' },
      { from: 'ingest', to: 'metric' },
      { from: 'ingest', to: 'content' },
      { from: 'metric', to: 'mongo' },
      { from: 'content', to: 'mongo' },
      { from: 'mongo', to: 'csr', label: 'oplog' },
      { from: 'csr', to: 'events' },
      { from: 'events', to: 'indexer' },
      { from: 'indexer', to: 'es' },
      { from: 'es', to: 'frontend', label: 'reads' },
      { from: 'events', to: 'folder' },
      { from: 'folder', to: 'procs' },
      { from: 'procs', to: 'events', label: 'publish' },
      { from: 'events', to: 'content', label: 'writes' },
      { from: 'spr', to: 'content', style: 'dashed' },
      { from: 'spr', to: 'metric', style: 'dashed' },
    ],
  },

  flows: [
    {
      label: 'Follow a post',
      steps: [
        { edges: [['networks', 'collectors']], note: 'A Collector pulls a new post from a social network.' },
        { edges: [['collectors', 'ingest']], note: 'It publishes the post to an ingestion topic instead of calling the next stage directly.' },
        { edges: [['ingest', 'metric'], ['ingest', 'content']], note: 'The Content and Metric services each pick it up, in parallel.' },
        { edges: [['metric', 'mongo'], ['content', 'mongo']], note: 'Both save it in MongoDB in one data model, with network-specific extras defined in the Platform Registry.' },
        { edges: [['mongo', 'csr']], note: 'The write lands in MongoDB’s oplog, which the change stream reader is watching.' },
        { edges: [['csr', 'events']], note: 'The database change becomes a domain event (eg ContentCreated).' },
        { edges: [['events', 'indexer']], note: 'The Elasticsearch indexer is one subscriber. It copies the change into the read side.' },
        { edges: [['indexer', 'es'], ['es', 'frontend']], note: 'Seconds after it was collected, the post shows up in the Hootsuite frontend.' },
        { edges: [['events', 'folder']], note: 'Meanwhile, events that would trigger the same aggregation are folded into one.' },
        { edges: [['folder', 'procs']], note: 'One delayed event reaches the processors, so an account’s totals are computed once, not once per post.' },
        { edges: [['procs', 'events']], note: 'Processors publish their results as new events.' },
        { edges: [['events', 'content']], note: 'The Content service writes them, which sets off more events. One post starts a cascade, which is where the name Avalanche came from.' },
      ],
    },
  ],
};

export default arch;

/** "Getting there": both systems fed the same data, and their results were compared before switching readers */
export const migration: Architecture = {
  description:
    'Running both systems. Collectors fed the same data into the per-network Kestrel pipelines and into Avalanche. ' +
    'Results from both were read back and compared, and the Hootsuite frontend moved its reads to Avalanche behind feature flags.',
  after: {
    label: 'Migration',
    groups: [
      { label: 'LiftMetrix', x: 2, y: 0, w: 3, h: 1 },
      { label: 'Avalanche', x: 2, y: 2, w: 3, h: 1 },
    ],
    nodes: [
      { id: 'networks', label: 'Social networks', sub: 'APIs', kind: 'external', x: 0, y: 1 },
      { id: 'collectors', label: 'Collectors', sub: 'scrapers', kind: 'service', x: 1, y: 1 },
      { id: 'pipelines', label: 'Kestrel pipelines', sub: 'one per network', kind: 'service', x: 2, y: 0 },
      { id: 'olddb', label: 'MongoDB + ES', sub: 'schema per network', kind: 'store', x: 3, y: 0 },
      { id: 'oldapp', label: 'LiftMetrix app', sub: 'PHP monolith', kind: 'service', x: 4, y: 0 },
      { id: 'ingest', label: 'Ingestion topic', sub: 'Kafka', kind: 'queue', x: 2, y: 2 },
      { id: 'avalanche', label: 'Avalanche', sub: 'events + stores', kind: 'service', x: 3, y: 2 },
      { id: 'apis', label: 'Avalanche APIs', kind: 'service', x: 4, y: 2 },
      { id: 'compare', label: 'Diff script', sub: 'compares exports', kind: 'service', x: 4, y: 1 },
      { id: 'frontend', label: 'Hootsuite Frontend', sub: 'feature flags', kind: 'client', x: 5, y: 1 },
    ],
    edges: [
      { from: 'networks', to: 'collectors' },
      { from: 'collectors', to: 'pipelines' },
      { from: 'collectors', to: 'ingest' },
      { from: 'pipelines', to: 'olddb' },
      { from: 'olddb', to: 'oldapp' },
      { from: 'ingest', to: 'avalanche' },
      { from: 'avalanche', to: 'apis' },
      { from: 'oldapp', to: 'compare' },
      { from: 'apis', to: 'compare' },
      { from: 'oldapp', to: 'frontend', label: 'flag off', style: 'dashed' },
      { from: 'apis', to: 'frontend', label: 'flag on' },
    ],
  },
  flows: [
    {
      label: 'Run both',
      steps: [
        { edges: [['networks', 'collectors']], note: 'A Collector pulls a post, the same way it always had.' },
        { edges: [['collectors', 'pipelines'], ['collectors', 'ingest']], note: 'It sends the post to both systems: the network’s Kestrel pipeline and Avalanche’s ingestion topic.' },
        { edges: [['pipelines', 'olddb'], ['ingest', 'avalanche']], note: 'Each system processes it in its own way.' },
        { edges: [['olddb', 'oldapp'], ['avalanche', 'apis']], note: 'Both serve the results through their own APIs.' },
        { edges: [['oldapp', 'compare'], ['apis', 'compare']], note: 'A script exported the data from both systems and compared it field by field.' },
        { edges: [['apis', 'frontend']], note: 'Once they did, a feature flag moved the frontend’s reads over to Avalanche. Turning the flag off moved them back.' },
      ],
    },
  ],
};
