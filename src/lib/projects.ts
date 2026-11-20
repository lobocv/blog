import type { CollectionEntry } from 'astro:content';
import { validate, type Architecture } from './diagram';

export type Project = CollectionEntry<'projects'>;

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** Published projects in production, all of them in dev. */
export async function getProjects(): Promise<Project[]> {
  const { getCollection } = await import('astro:content');
  const projects = await getCollection('projects', p => !(import.meta.env.PROD && p.data.draft));
  return sortProjects(projects);
}

const architectures = import.meta.glob<{ default: Architecture }>('../content/projects/*/architecture.ts', { eager: true });

/** The project's diagram data, checked so a typo fails the build instead of drawing a broken diagram. */
export function getArchitecture(slug: string): Architecture | undefined {
  const arch = architectures[`../content/projects/${slug}/architecture.ts`]?.default;
  if (!arch) return undefined;
  const errs = validate(arch);
  if (errs.length) throw new Error(`projects/${slug}/architecture.ts:\n  ${errs.join('\n  ')}`);
  return arch;
}
