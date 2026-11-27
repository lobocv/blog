// What a social network is to the share page. Each network implements this in its own folder
// under networks/, and shared code only ever talks to this interface (see the no-branching rule
// in docs/editor/sharing-design.md). When a network needs to behave differently, the difference
// becomes a field or method here, and every network implements it.

export type MediaKind = 'image' | 'link-card' | 'text-only';

export type Size = { width: number; height: number };
/** An image size the network shows well, eg { id: 'landscape', label: 'Landscape', width: 1200, height: 628 }. */
export type Shape = { id: string; label: string } & Size;

/** Where the feed cuts the post behind "…see more", if it does. */
export type Fold = { kind: 'none' } | { kind: 'lines'; lines: number; viewport: 'phone' };

/** The parts of a post a network puts together into the text to paste. */
export type Parts = { text: string; link: string; hashtags: string[] };

/**
 * The text to paste. An offset into Calvin's text plus `shift` is the same place in `text`, so
 * checks and the preview can map between the two.
 */
export type Assembled = { text: string; shift: number };

/** A failed check. `ranges` are offsets into Calvin's text, to highlight. */
export type Failure = { check: string; message: string; ranges: { from: number; to: number }[] };

export interface Network {
  id: string;
  label: string;
  /** Opens the network's compose box. */
  composeUrl: string;

  /** The network's own character count for `text` (eg some count any URL as a fixed length). */
  count(text: string): number;
  limit: number;
  fold: Fold;
  /** Calvin's text, the link and the hashtags, in the order the network wants them. */
  assemble(parts: Parts): Assembled;

  hashtags: { min: number; max: number; placement: 'end' | 'inline' };

  /** What a post can carry, and the default when Calvin hasn't chosen. */
  media: MediaKind[];
  defaultMedia: MediaKind;
  /** The sizes an image can be rendered at. Empty when the network takes no images. */
  imageShapes: Shape[];
  /** The shape (its id) for a figure of this size, when Calvin hasn't chosen. */
  defaultShape(figure: Size): string;
  /** Whether the network takes alt text for an image. */
  altText: boolean;

  defaultLink: 'tagged' | 'short';
  utmSource: string;

  /** Checks only this network needs, run after the shared ones. */
  checks?: ((parts: Parts, assembled: Assembled) => Failure[])[];
}
