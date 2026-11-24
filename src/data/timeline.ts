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
        "I did an Honours BSc in Physics at McMaster, in the co-op stream. I spent my co-op terms in research: at Simon Fraser University, building simulations of ultra-fast electron dynamics, and at the Canadian Space Agency, modelling the interaction between the Sun and the Earth's magnetic field.",
        "I enjoyed the technical and analytical side of research, but it was very slow paced and did not have great career opportunities. Writing simulation software was the part I could take with me, so I used that experience to pivot into software development.",
      ] },
    { id: 'sensors', kind: 'work', start: '2013-07', end: '2017-11', when: 'Jul 2013 – Nov 2017', era: 'Sensors & Software',
      title: 'Sensors & Software', role: 'Software Developer', scene: 'radar-ground', age: 1, paragraphs: [
        "Sensors & Software makes ground penetrating radar (GPR), which sends radio pulses into the ground and reads the echoes to find what is buried (eg rebar, pipes, the thickness of concrete or ice). I am incredibly grateful, and lucky, to have got the opportunity to work here. They told me they would rather hire someone and teach them software than have to teach them physics. It is where I fell in love with writing software and had the room to build my skills.",
        "We were a team of two developers building the application software for a new generation of products (the LMX100, LMX200 and Conquest 100). We wrote it in Python so we could move fast. The devices had no hardware acceleration, which ruled out the UI framework we wanted, so we wrote our own on top of Pygame. It started with the Conquest 100 and grew over several years into the base for the whole product line, with the feel of a mobile app. Underneath it, I wrote the radar signal processing libraries in C/C++ that turn raw radar data into images.",
        "Several open source projects came out of that work, each one built because the radar applications needed it: [eventdispatcher](https://github.com/lobocv/eventdispatcher), [pyperform](https://github.com/lobocv/pyperform), [crashreporter](https://github.com/lobocv/crashreporter) and [anonymoususage](https://github.com/lobocv/anonymoususage). crashreporter is a good example. The radars work in the field with no internet, so we rarely heard about bugs in any useful detail. The library catches a crash, stores the report on the device and uploads it once the radar is back on wifi.",
        "Near the end I worked with a university researcher to read the moisture content of lumber from a radar pulse. The model I built reads within 2 to 5% of an oven test that takes one to two days.",
      ],
      link: { href: '/projects/log-moisture-meter/', label: 'How the log moisture meter works' } },
    { id: 'patriot', kind: 'work', start: '2017-11', end: '2018-11', when: 'Nov 2017 – Nov 2018', era: 'Patriot One',
      title: 'Patriot One Technologies', role: 'Software Engineer', scene: 'radar-sweep', age: 2, paragraphs: [
        "Patriot One was a start-up building a concealed weapons detection system from microwave radar and machine learning. It was radar again, but this time I was also leading.",
        "I did a lot of the development myself, on the core processing and the research side: data acquisition, the processing flow and custom signal processing to help with detection. We built the back end as microservices that talk over ZeroMQ and ship in Docker, and we had to keep the current generation of the software running while we built the one that would replace it.",
        "I also did the planning and was team lead for the six developers who handled the application code. That meant the backlog, the roadmap with the business and research groups, how we release, and a testing framework built together with the QA team.",
      ] },
    { id: 'stratoscale', kind: 'work', start: '2018-11', end: '2019-12', when: 'Nov 2018 – Dec 2019', era: 'Stratoscale',
      title: 'Stratoscale', role: 'Backend Software Developer', scene: 'clouds', age: 2, paragraphs: [
        "Stratoscale built Symphony, private cloud software that lets a company run its own cloud on its own hardware, with AWS and GCP compatible APIs. This was my move from radar and devices to backend and cloud work.",
        "I built and maintained the microservices behind the managed database offering. They provision, upgrade and talk to database clusters (eg MySQL, PostgreSQL, MongoDB and Redis), and every new API shipped with documentation and unit, subsystem and integration tests. I also looked after the in-house orchestration software, hosted on AWS, that we used to monitor, upgrade, license and remotely debug customer clusters.",
      ] },
    { id: 'hootsuite-analytics', kind: 'work', start: '2020-02', end: '2024-01', when: 'Feb 2020 – 2024', era: 'Hootsuite',
      title: 'Hootsuite, Social Analytics', role: 'Senior, then Staff Software Engineer', scene: 'avalanche', age: 2, paragraphs: [
        "In early 2020 I joined the team behind Impact, Hootsuite's enterprise analytics product. It had come in through an acquisition and still leaned on a PHP monolith more than seven years old, which the team was partway through porting to Go microservices. Six months in, I proposed a different architecture.",
        "We called it Avalanche. Every social network shares one data model, services publish events about what happened, and other services react to them. That replaced a separate pipeline for each network. We built it next to the old system, fed data into both until they matched, then migrated the data and retired the PHP monolith. I led the team that built it (four backend developers, two front end developers, a designer and a product manager) and became a Staff Engineer in 2021.",
        "Avalanche collects hundreds of millions of posts from millions of accounts, and adding a social network went from about 10 months of work to 2. When the volume outgrew how fast we could turn database changes into events, I sharded the change streams and the delay dropped from hours to seconds. The shared data model also meant we could finally build things customers had asked for over the years (eg custom metrics that combine several networks and are calculated on demand).",
      ],
      link: { href: '/projects/avalanche/', label: 'How we built Avalanche' } },
    { id: 'hootsuite-arch', kind: 'work', start: '2024-01', end: '2025-08', when: '2024 – Aug 2025', era: 'Hootsuite',
      title: 'Hootsuite, Architecture', role: 'Staff Software Engineer (Architecture)', scene: 'summit', age: 3, paragraphs: [
        "In 2024 I moved to an architecture role across the whole engineering organization, working with the VP of Software on the long-term technical direction. Years of acquisitions had left teams with their own ways of building APIs and very little shared tooling.",
        "I made the case for investing in API standards and then led the work. I wrote the RFCs for a REST style guide and for API versioning, and picked rules a linter could enforce, because a standard that relies on people remembering it doesn't last. The tooling followed: linting, breaking change detection, a registry of every service's OpenAPI spec and generated SDKs. Along the way I contributed fixes and features to vacuum, the open source linter we built on.",
        "I also worked as architectural support for team leads across the org on their various initiatives, led the company's architecture guild and Go guild, and started a set of shared Go libraries so that common problems get solved once (eg tracing and metrics switched on by default for REST services).",
      ] },
    { id: 'pulley', kind: 'work', start: '2025-09', end: '2026-08', when: 'Sep 2025 – Aug 2026', era: 'Pulley',
      title: 'Pulley', role: 'Staff Software Engineer (Architect / Tech Lead)', scene: 'ridge', age: 3, paragraphs: [
        "Pulley makes equity management software (cap tables, the record of who owns what in a company). I joined as a Staff Engineer with two jobs: tech lead of a product team, and architect for the core product.",
        "The team (five developers, a product manager and a designer) builds the core cap table calculations and reporting, on a Go backend with a TypeScript and React front end. As architect I brought in Clean Architecture and Domain Driven Design so the codebase stays testable and flexible as it grows, and I advised the sibling product team and the AI teams.",
        "A lot of my time went into how engineers work with AI agents: a graph-based knowledge base, shared skills and workflows, and MCP tools, together with the mentoring and documentation a team needs to adopt them. I also led the Go and Architecture guilds.",
      ] },
    { id: 'infisical', kind: 'work', start: '2026-08', end: '2026-10', when: 'Aug 2026 – Oct 2026', era: 'Infisical',
      title: 'Infisical', role: 'Architect', scene: 'ridge', age: 3, paragraphs: [
        "Infisical builds secrets management software. I joined as an architect, working directly with the CTO and founding engineers on how to grow both the engineering team and the software.",
        "The main piece was their migration from Node.js to Go. I reworked the strategy to add end-to-end tests through the public API, and to group well over a hundred services into a smaller set of domains. I also introduced decision records, testing practices and a layered, domain-driven architecture, and mentored developers from junior to senior.",
      ] },
  ],
  side: [],
};
