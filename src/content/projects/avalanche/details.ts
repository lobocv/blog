// Small static diagrams shown at the top of each Detail block on the Avalanche page.
import type { Architecture, DiagramEdge, DiagramGroup, DiagramNode } from '../../../lib/diagram';

const still = (description: string, nodes: DiagramNode[], edges: DiagramEdge[], groups?: DiagramGroup[]): Architecture =>
  ({ description, after: { label: description, nodes, edges, groups } });

export const pipeline = still(
  'Each network had its own stages, which wrote to MongoDB and then Elasticsearch in that network’s own schema. The PHP monolith normalized the data when it read it.',
  [
    { id: 'fb', label: 'Facebook stages', sub: 'writes Mongo, then ES', kind: 'service', x: 0, y: 0 },
    { id: 'tw', label: 'Twitter stages', sub: 'writes Mongo, then ES', kind: 'service', x: 0, y: 1 },
    { id: 'mongo', label: 'MongoDB', sub: 'schema per network', kind: 'store', x: 1, y: 0 },
    { id: 'es', label: 'Elasticsearch', sub: 'schema per network', kind: 'store', x: 1, y: 1 },
    { id: 'app', label: 'PHP monolith', sub: 'normalizes on read', kind: 'client', x: 2, y: 0.5 },
  ],
  [
    { from: 'fb', to: 'mongo', style: 'tangle' },
    { from: 'fb', to: 'es', style: 'tangle' },
    { from: 'tw', to: 'mongo', style: 'tangle' },
    { from: 'tw', to: 'es', style: 'tangle' },
    { from: 'mongo', to: 'app' },
    { from: 'es', to: 'app' },
  ],
);

export const events = still(
  'A service publishes a domain event. Every interested service subscribes to it, and a new flow is just one more subscriber.',
  [
    { id: 'pub', label: 'Any service', sub: 'writes a post', kind: 'service', x: 0, y: 1 },
    { id: 'topic', label: 'Domain events', sub: 'ContentCreated', kind: 'queue', x: 1, y: 1 },
    { id: 'a', label: 'ES indexer', kind: 'service', x: 2, y: 0 },
    { id: 'b', label: 'Stream processor', kind: 'service', x: 2, y: 1 },
    { id: 'c', label: 'Next new flow', sub: 'just subscribes', kind: 'service', x: 2, y: 2 },
  ],
  [
    { from: 'pub', to: 'topic', label: 'publish' },
    { from: 'topic', to: 'a' },
    { from: 'topic', to: 'b' },
    { from: 'topic', to: 'c', style: 'dashed' },
  ],
);

export const model = still(
  'Posts from every network are normalized on write into one data model with network extensions, so services that read them need no per-network code.',
  [
    { id: 'fb', label: 'Facebook post', kind: 'external', x: 0, y: 0 },
    { id: 'li', label: 'LinkedIn post', kind: 'external', x: 0, y: 1 },
    { id: 'svc', label: 'Content service', sub: 'normalizes on write', kind: 'service', x: 1, y: 0.5 },
    { id: 'doc', label: 'One data model', sub: '+ network extensions', kind: 'store', x: 2, y: 0.5 },
    { id: 'any', label: 'Any service', sub: 'no switch needed', kind: 'service', x: 3, y: 0.5 },
  ],
  [
    { from: 'fb', to: 'svc' },
    { from: 'li', to: 'svc' },
    { from: 'svc', to: 'doc' },
    { from: 'doc', to: 'any', label: 'reads' },
  ],
);

export const changestreams = still(
  'MongoDB is sharded by a hash of account and network. Each reader pod opens a limited number of shard change streams and publishes domain events.',
  [
    { id: 's1', label: 'Shard 1', sub: 'change stream', kind: 'store', x: 0, y: 0 },
    { id: 's2', label: 'Shard 2', sub: 'change stream', kind: 'store', x: 0, y: 1 },
    { id: 's3', label: 'Shard N', sub: 'change stream', kind: 'store', x: 0, y: 2 },
    { id: 'p1', label: 'Reader pod', sub: 'max streams per pod', kind: 'service', x: 1, y: 0.5 },
    { id: 'p2', label: 'Reader pod', sub: 'max streams per pod', kind: 'service', x: 1, y: 2 },
    { id: 'ev', label: 'Domain events', sub: 'Kafka', kind: 'queue', x: 2, y: 1 },
  ],
  [
    { from: 's1', to: 'p1' },
    { from: 's2', to: 'p1' },
    { from: 's3', to: 'p2' },
    { from: 'p1', to: 'ev' },
    { from: 'p2', to: 'ev' },
  ],
  [{ label: 'Hash(account, network)', x: 0, y: 0, w: 1, h: 3 }],
);

export const folding = still(
  'A burst of post-level events for one account is folded into a single delayed event, so the account aggregation runs once.',
  [
    { id: 'e1', label: 'Post 1 updated', kind: 'queue', x: 0, y: 0 },
    { id: 'e2', label: 'Post 2 updated', kind: 'queue', x: 0, y: 1 },
    { id: 'e3', label: 'Post 3 updated', kind: 'queue', x: 0, y: 2 },
    { id: 'fold', label: 'Event folder', sub: 'one entry per account', kind: 'service', x: 1, y: 1 },
    { id: 'out', label: 'Account updated', sub: 'after a quiet window', kind: 'queue', x: 2, y: 1 },
    { id: 'agg', label: 'Aggregation', sub: 'runs once', kind: 'service', x: 3, y: 1 },
  ],
  [
    { from: 'e1', to: 'fold' },
    { from: 'e2', to: 'fold' },
    { from: 'e3', to: 'fold' },
    { from: 'fold', to: 'out' },
    { from: 'out', to: 'agg' },
  ],
);

export const cqrs = still(
  'Services write to MongoDB. The ES indexer subscribes to domain events and copies changes into Elasticsearch, which the frontend reads.',
  [
    { id: 'svc', label: 'Services', kind: 'service', x: 0, y: 0 },
    { id: 'mongo', label: 'MongoDB', kind: 'store', x: 1, y: 0 },
    { id: 'ev', label: 'Domain events', kind: 'queue', x: 2, y: 0 },
    { id: 'idx', label: 'ES indexer', kind: 'service', x: 2, y: 1 },
    { id: 'es', label: 'Elasticsearch', sub: 'slots for metrics', kind: 'store', x: 1, y: 1 },
    { id: 'fe', label: 'Hootsuite Frontend', kind: 'client', x: 0, y: 1 },
  ],
  [
    { from: 'svc', to: 'mongo', label: 'writes' },
    { from: 'mongo', to: 'ev' },
    { from: 'ev', to: 'idx' },
    { from: 'idx', to: 'es' },
    { from: 'es', to: 'fe', label: 'reads' },
  ],
  [
    { label: 'Write side', x: 0, y: 0, w: 3, h: 1 },
    { label: 'Read side', x: 0, y: 1, w: 3, h: 1 },
  ],
);

export const spr = still(
  'An admin CLI registers networks in the Platform Registry. Services read their own namespace from it at startup.',
  [
    { id: 'cli', label: 'Admin CLI', sub: 'register a network', kind: 'client', x: 0, y: 1 },
    { id: 'spr', label: 'Platform Registry', sub: 'JSON per network', kind: 'config', x: 1, y: 1 },
    { id: 'content', label: 'Content service', sub: 'extension schemas', kind: 'service', x: 2, y: 0 },
    { id: 'metric', label: 'Metric service', sub: 'per-network rules', kind: 'service', x: 2, y: 1 },
    { id: 'csr', label: 'Change streams', sub: 'shards per network', kind: 'service', x: 2, y: 2 },
  ],
  [
    { from: 'cli', to: 'spr' },
    { from: 'spr', to: 'content', style: 'dashed' },
    { from: 'spr', to: 'metric', style: 'dashed', label: 'startup' },
    { from: 'spr', to: 'csr', style: 'dashed' },
  ],
);

export const parallel = still(
  'The migration in five steps: feed both systems, diff their exports, migrate historical data, move reads over with feature flags, then turn off the old services.',
  [
    { id: 'feed', label: 'Feed both', sub: 'Collectors', kind: 'service', x: 0, y: 0 },
    { id: 'diff', label: 'Diff exports', sub: 'field by field', kind: 'service', x: 1, y: 0 },
    { id: 'hist', label: 'Migrate history', kind: 'service', x: 2, y: 0 },
    { id: 'flag', label: 'Move reads', sub: 'feature flags', kind: 'service', x: 2, y: 1 },
    { id: 'off', label: 'Turn off LiftMetrix', kind: 'service', x: 1, y: 1 },
  ],
  [
    { from: 'feed', to: 'diff' },
    { from: 'diff', to: 'hist', label: 'parity' },
    { from: 'hist', to: 'flag' },
    { from: 'flag', to: 'off', label: 'trusted' },
  ],
);

export const lessons = still(
  'What we built: services call the registry at startup. What I would build: config files in git, copied into each service.',
  [
    { id: 'svc1', label: 'Each service', kind: 'service', x: 0, y: 0 },
    { id: 'reg', label: 'Registry service', sub: 'runtime dependency', kind: 'service', x: 1, y: 0 },
    { id: 'files', label: 'Config files', sub: 'in git, reviewed', kind: 'config', x: 0, y: 1 },
    { id: 'svc2', label: 'Each service', sub: 'no extra call', kind: 'service', x: 1, y: 1 },
  ],
  [
    { from: 'svc1', to: 'reg', label: 'startup', style: 'tangle' },
    { from: 'files', to: 'svc2', label: 'copied' },
  ],
  [
    { label: 'What we built', x: 0, y: 0, w: 2, h: 1 },
    { label: 'What I’d build', x: 0, y: 1, w: 2, h: 1 },
  ],
);
