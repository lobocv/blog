// The enabled networks, in tab order. The only file that imports network modules.
import type { Network } from '../network.ts';
import { linkedin } from './linkedin/index.ts';

export const networks: readonly Network[] = [linkedin];

export const networkById = (id: string): Network | undefined => networks.find((n) => n.id === id);
