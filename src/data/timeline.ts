// The journey page's content. Chapters are the main story and never overlap; side items
// (renovations, hobbies, side projects) ran alongside them and attach to a chapter by date.
// Checked by validateTimeline in src/lib/timeline.ts, so bad data fails the build.

/** pup, yearling, adult, grey muzzle */
export type Age = 0 | 1 | 2 | 3;
export type SceneId = 'fork' | 'sky' | 'radar-ground' | 'radar-sweep' | 'clouds' | 'avalanche' | 'summit' | 'ridge' | 'overlook';
/** 'YYYY-MM' */
export type Month = `${number}-${string}`;

export interface Chapter {
  id: string;
  kind: 'work' | 'life';
  start: Month;
  /** Omitted means ongoing */
  end?: Month;
  /** Display dates, eg 'Jul 2013 – Nov 2017' */
  when: string;
  /** Short name in the scene's corner */
  era: string;
  title: string;
  role?: string;
  scene: SceneId;
  age: Age;
  paragraphs: string[];
  bullets?: string[];
  link?: { href: string; label: string };
}

export interface SideItem {
  kind: 'renovation' | 'hobby' | 'project';
  start: Month;
  end?: Month;
  when: string;
  title: string;
  /** One line, always shown */
  summary: string;
  /** Shown when expanded */
  body?: string;
}

export const TIMELINE: { draft: boolean; chapters: Chapter[]; side: SideItem[] } = {
  draft: true,
  chapters: [
    { id: 'mcmaster', kind: 'work', start: '2008-09', end: '2013-04', when: '2008 – 2013', era: 'University',
      title: 'McMaster University', role: 'Honours BSc Physics (co-op)', scene: 'sky', age: 0, paragraphs: [
        "I did an Honours BSc in Physics at McMaster, in the co-op stream, and made the Dean's Honour List each year.",
        "The degree is what got me into radar. My first job out of school was writing software for ground penetrating radar.",
      ] },
    { id: 'sensors', kind: 'work', start: '2013-07', end: '2017-11', when: 'Jul 2013 – Nov 2017', era: 'Sensors & Software',
      title: 'Sensors & Software', role: 'Software Developer', scene: 'radar-ground', age: 1, paragraphs: [
        "Sensors & Software makes ground penetrating radar (GPR), which sends radio pulses into the ground and reads the echoes to find what is buried (eg rebar, pipes, the thickness of concrete or ice). I joined as an applications specialist and spent four years writing the software that runs on the radars.",
        "We were a team of two developers building the application software for a new generation of products (the LMX100, LMX200 and Conquest 100). We wrote it in Python so we could move fast. The devices had no hardware acceleration, which ruled out the UI framework we wanted, so we wrote our own on top of Pygame. It started with the Conquest 100 and grew over several years into the base for the whole product line, with the feel of a mobile app.",
        "The radars work in the field with no internet, so we rarely heard about bugs in any useful detail. I wrote crashreporter, an open source library that catches a crash, stores the report on the device and uploads it once the radar is back on wifi. Near the end I worked with a university researcher to read the moisture content of lumber from a radar pulse, which replaced a one to two day oven test.",
      ],
      bullets: [
        "Python application software and an in-house UI framework for the embedded GPR product line",
        "C/C++ processing that turns radar data into images, exposed to Python",
        "Build, licensing and deployment servers with REST APIs (Jenkins, Flask)",
        "A regression model (PLSR) that reads log moisture from a radar waveform, within 2 to 5%",
      ],
      link: { href: '/projects/log-moisture-meter/', label: 'How the log moisture meter works' } },
    { id: 'patriot', kind: 'work', start: '2017-11', end: '2018-11', when: 'Nov 2017 – Nov 2018', era: 'Patriot One',
      title: 'Patriot One Technologies', role: 'Software Engineer', scene: 'radar-sweep', age: 2, paragraphs: [
        "Patriot One was a start-up building a concealed weapons detection system from microwave radar and machine learning. It was radar again, but this time I was leading: a software team of six, and the software group's voice in engineering meetings.",
        "I oversaw the back end, from data acquisition and the processing flow to the database design and tech stack. We built it as microservices that talk over ZeroMQ and ship in Docker, and I wrote signal processing to help with detection. We had to keep the current generation of the software running while we built the one that would replace it.",
        "A lot of the job was the process around the code. I was scrum master, groomed the backlog, planned how we release, and met with the business and research groups to agree on the roadmap.",
      ],
      bullets: [
        "Led a team of six developers and mentored the junior ones",
        "Microservices and their messaging framework on ZeroMQ and Docker",
        "A testing framework built with the QA team (unit, usability and integration tests)",
      ] },
    { id: 'stratoscale', kind: 'work', start: '2018-11', end: '2019-12', when: 'Nov 2018 – Dec 2019', era: 'Stratoscale',
      title: 'Stratoscale', role: 'Backend Software Developer', scene: 'clouds', age: 2, paragraphs: [
        "Stratoscale built Symphony, private cloud software that lets a company run its own cloud on its own hardware, with AWS-compatible APIs. This was my move from radar and devices to backend and cloud work.",
        "I built and maintained the microservices behind the managed database offering. They provision, upgrade and talk to database clusters (eg MySQL, PostgreSQL, MongoDB and Redis). I also looked after the in-house orchestration software, hosted on AWS, that we used to monitor, upgrade, license and remotely debug customer clusters.",
      ],
      bullets: [
        "New APIs and features shipped with documentation and unit, subsystem and integration tests",
        "Design reviews, and assessments of the architecture and its technical debt",
      ] },
    { id: 'hootsuite-analytics', kind: 'work', start: '2020-02', end: '2024-01', when: 'Feb 2020 – 2024', era: 'Hootsuite',
      title: 'Hootsuite, Social Analytics', role: 'Senior, then Staff Software Engineer', scene: 'avalanche', age: 2, paragraphs: [
        "In early 2020 I joined the team behind Impact, Hootsuite's enterprise analytics product. It had come in through an acquisition and still leaned on a PHP monolith more than seven years old, which the team was partway through porting to Go microservices. Six months in, I proposed a different architecture.",
        "We called it Avalanche. Every social network shares one data model, services publish events about what happened, and other services react to them. That replaced a separate pipeline for each network. We built it next to the old system, fed data into both until they matched, then migrated the data and switched the old one off. I led the team that built it (four backend developers, two front end developers, a designer and a product manager) and became a Staff Engineer in 2021.",
        "Avalanche collects hundreds of millions of posts from millions of accounts, and adding a social network went from about 10 months of work to 2. It also made features cheap that had been turned down for years as too much effort (eg custom metrics that combine several networks and are calculated on demand).",
      ],
      bullets: [
        "Cut the delay in turning database changes into events from hours to seconds by sharding the change streams",
        "Retired the PHP monolith and moved the acquired product onto Hootsuite's own organizations and accounts",
        "A LinkedIn Ads collector that stays under rate limits by batching, with up to 75x fewer API calls",
        "A classifier that sorts posts by intent (educate, convert, inspire, entertain) at 75 to 82% accuracy",
      ],
      link: { href: '/projects/avalanche/', label: 'How we built Avalanche' } },
    { id: 'hootsuite-arch', kind: 'work', start: '2024-01', end: '2025-08', when: '2024 – Aug 2025', era: 'Hootsuite',
      title: 'Hootsuite, Architecture', role: 'Staff Software Engineer (Architecture)', scene: 'summit', age: 3, paragraphs: [
        "In 2024 I moved to an architecture role across the whole engineering organization, working with the VP of Software on the long-term technical direction. Years of acquisitions had left teams with their own ways of building APIs and very little shared tooling.",
        "I made the case for investing in API standards and then led the work. I wrote the RFCs for a REST style guide and for API versioning, and picked rules a linter could enforce, because a standard that relies on people remembering it doesn't last. The tooling followed: linting, breaking change detection, a registry of every service's OpenAPI spec and generated SDKs. Along the way I contributed fixes and features to vacuum, the open source linter we built on.",
        "I also led the company's architecture guild and Go guild, and started a set of shared Go libraries so that common problems get solved once (eg a testing library that gives every test its own database).",
      ],
      bullets: [
        "A REST style guide enforced by about 16 custom lint rules",
        "A database per test for SQL integration tests, which ran more than 2x faster",
        "OpenTelemetry tracing and metrics switched on by default for REST services",
        "Mentoring developers and advising teams on technical decisions",
      ] },
    { id: 'pulley', kind: 'work', start: '2025-09', end: '2026-08', when: 'Sep 2025 – Aug 2026', era: 'Pulley',
      title: 'Pulley', role: 'Staff Software Engineer (Architect / Tech Lead)', scene: 'ridge', age: 3, paragraphs: [
        "Pulley makes equity management software (cap tables, the record of who owns what in a company). I joined as a Staff Engineer with two jobs: tech lead of a product team, and architect for the core product.",
        "The team (five developers, a product manager and a designer) builds the core cap table calculations and reporting. As architect I brought in Clean Architecture and Domain Driven Design so the codebase stays testable and flexible as it grows, and I advised the sibling product team and the AI teams.",
        "A lot of my time went into how engineers work with AI agents: a graph-based knowledge base, shared skills and workflows, and MCP tools, together with the mentoring and documentation a team needs to adopt them. I also led the Go and Architecture guilds.",
      ],
      bullets: [
        "Go, TypeScript and React, Postgres, Redis and Temporal, on Kubernetes in Google Cloud",
      ] },
    { id: 'infisical', kind: 'work', start: '2026-08', end: '2026-10', when: 'Aug 2026 – Oct 2026', era: 'Infisical',
      title: 'Infisical', role: 'Architect', scene: 'ridge', age: 3, paragraphs: [
        "Infisical builds secrets management software. I joined as an architect, working directly with the CTO and founding engineers on how to grow both the engineering team and the software.",
        "The main piece was their migration from Node.js to Go. I reworked the strategy to add end-to-end tests through the public API, and to group well over a hundred services into a smaller set of domains. I also introduced decision records, testing practices and a layered, domain-driven architecture, and mentored developers from junior to senior.",
      ] },
  ],
  side: [],
};
