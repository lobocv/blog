// Each network's phone preview, by network id. The one place outside the network folders that
// names networks; previews.test.ts keeps it in step with the registry.
import type { ComponentType } from 'preact';
import type { PreviewProps } from '../preview-props.ts';
import { LinkedInPreview } from './linkedin.tsx';

export const previews: Record<string, ComponentType<PreviewProps>> = {
  linkedin: LinkedInPreview,
};
