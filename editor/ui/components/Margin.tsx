import { useLayoutEffect, useRef } from 'preact/hooks';
import { locate } from '../../domain/anchor.ts';
import type { ThreadState } from '../thread-state.ts';
import { Composer } from './Composer.tsx';
import { ThreadCard } from './ThreadCard.tsx';

type Props = {
  state: ThreadState;
  text: string;
  /** Pixels from the top of the text to `pos`. */
  topOf: (pos: number) => number;
  /** Changes whenever lines move, so cards follow their words. */
  layout: number;
  keyPrefix: string;
  /** Extra classes, eg to float the margin over the preview. */
  class?: string;
  /** Hands focus back to the writing after a message is sent or cancelled. */
  onDone: () => void;
};

const GAP = 10;

/** Threads beside the words they're about. Cards that would overlap are pushed down. */
export function Margin({ state, text, topOf, layout, keyPrefix, class: extra, onDone }: Props) {
  const list = useRef<HTMLDivElement>(null);
  const composing = state.composing.value;
  const draft = composing?.kind === 'comment' ? locate(text, composing.anchor) : undefined;

  const entries = state.items.value.map((item) => ({ key: item.id, top: topOf(item.range.from), item }));
  if (draft) entries.push({ key: 'new', top: topOf(draft.from), item: undefined as never });
  entries.sort((a, b) => a.top - b.top);

  // Place cards after they're drawn, when their heights are known.
  useLayoutEffect(() => {
    let bottom = -Infinity;
    for (const el of list.current?.children ?? []) {
      const card = el as HTMLElement;
      const top = Math.max(Number(card.dataset.top), bottom + GAP);
      card.style.top = `${top}px`;
      bottom = top + card.offsetHeight;
    }
  });

  const finish = (sent: boolean) => {
    if (sent) onDone();
    return sent;
  };
  const cancel = () => {
    state.composing.value = undefined;
    onDone();
  };

  return (
    <aside class={`margin${extra ? ` ${extra}` : ''}`} aria-label="Threads" data-layout={layout}>
      <div class="margin-list" ref={list}>
        {entries.map(({ key, top, item }) =>
          key === 'new' ? (
            <div class="margin-entry" key={key} data-top={top}>
              <div class="thread thread-on">
                <Composer label="Comment" onSend={async (t) => finish(await state.send(t))} onCancel={cancel} />
              </div>
            </div>
          ) : (
            <div class="margin-entry" key={key} data-top={top}>
              <ThreadCard
                kind={item.kind}
                messages={item.messages}
                selected={state.selected.value === item.id}
                keyPrefix={keyPrefix}
                replying={composing?.kind === 'reply' && composing.id === item.id}
                working={state.working.value?.threadId === item.id ? state.working.value : undefined}
                onSelect={() => (state.selected.value = item.id)}
                onReply={() => state.replyToSelected()}
                onResolve={() => void state.resolveSelected()}
                onSend={async (t) => finish(await state.send(t))}
                onCancel={cancel}
              />
            </div>
          ),
        )}
      </div>
      {state.error.value && <p class="margin-error">{state.error.value}</p>}
    </aside>
  );
}
