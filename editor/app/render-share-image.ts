// Renders a network's image (its chosen figure, theme and shape) and writes it next to the text.
import { figureUrl } from '../domain/figure-line.ts';
import type { Shape } from '../domain/social/network.ts';
import { networkById } from '../domain/social/networks/registry.ts';
import { imageKey, resolvePost } from '../domain/social/resolve.ts';
import type { FigureRef } from '../domain/social/social-post.ts';
import { NotFound, Refused } from './errors.ts';
import type { Clock, ImageRenderer, RenderTarget } from './ports.ts';
import { changePost, type Deps, fill, publishedPost } from './share-post.ts';

/** Where the preview server shows a figure: the editor's one-figure page, showing an image when it is one. */
export function renderTarget(figure: FigureRef, slug: string, origin: string): RenderTarget {
  const page = `${origin}/_editor/figure`;
  if (figure.kind === 'preview') return { page, image: `${origin}/og/${encodeURIComponent(slug)}.png` };
  if (figure.kind === 'image') return { page, image: figureUrl({ kind: 'image', src: figure.src, alt: '' }, origin) };
  return { page: figureUrl({ kind: 'component', name: '', source: figure.source, props: figure.props }, origin)! };
}

type RenderDeps = Deps & { renderer: ImageRenderer; clock: Clock; /** The preview server, once it answers. */ origin: () => Promise<string> };

export const renderShareImage = (deps: RenderDeps) => {
  // One render at a time per post, so a slow render can't land after a newer one and leave the
  // image and share.json disagreeing about what it shows.
  const queue = new Map<string, Promise<unknown>>();
  return (slug: string, networkId: string) => {
    const run = async () => {
      const post = await publishedPost(deps.library, slug);
      const network = networkById(networkId);
      if (!network) throw new NotFound(`No network named "${networkId}".`);
      const { image } = resolvePost(network, fill(await deps.share.load(slug)).networks[network.id], post);
      if (!image) throw new Refused(`The ${network.label} post doesn't carry an image.`);
      let shape: Shape | undefined;
      const { png } = await deps.renderer.render(renderTarget(image.figure, slug, await deps.origin()), {
        theme: image.theme,
        size: (figure) => {
          const id = image.shape ?? network.defaultShape(figure);
          shape = network.imageShapes.find((s) => s.id === id) ?? network.imageShapes[0];
          return shape;
        },
      });
      if (!shape) throw new Error('The renderer never asked for a size.');
      await deps.share.writeImage(slug, network.id, png);
      const rendered = { key: imageKey(image), shape: shape.id, width: shape.width, height: shape.height, at: deps.clock.now().toISOString() };
      return changePost(deps, slug, network.id, (p) => ({ ...p, rendered }));
    };
    const next = (queue.get(slug) ?? Promise.resolve()).then(run, run);
    queue.set(slug, next);
    return next;
  };
};

/** The rendered image's bytes, for the page and for saving. */
export const shareImage = (deps: Deps) => async (slug: string, networkId: string): Promise<Uint8Array> => {
  await publishedPost(deps.library, slug);
  if (!networkById(networkId)) throw new NotFound(`No network named "${networkId}".`);
  const png = await deps.share.readImage(slug, networkId);
  if (!png) throw new NotFound(`No image rendered for ${networkId} yet.`);
  return png;
};
