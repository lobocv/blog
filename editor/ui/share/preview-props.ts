// What every network's phone preview gets. Each preview lives in previews/<network id>.tsx and is
// styled like that network's feed.
import type { MeasuredFold } from '../../domain/social/checks.ts';
import type { MediaKind, Network } from '../../domain/social/network.ts';

export type PreviewProps = {
  network: Network;
  /** The assembled text, as it will be pasted. */
  text: string;
  media: MediaKind;
  /** The rendered image, when the media is an image and it has been rendered. */
  image?: { src: string; alt: string; width: number; height: number };
  post: { title: string; summary: string; image: string; postUrl: string };
  /**
   * Called with where the fold falls in `text` whenever it's measured (text changes, fonts load,
   * the width changes). Previews of networks without a fold never call it.
   */
  onFold: (fold: MeasuredFold) => void;
};
