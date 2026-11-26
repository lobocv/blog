import type { Message } from '../../domain/thread.ts';
import { Composer } from './Composer.tsx';
import { type SuggestionActions, SuggestionView } from './SuggestionView.tsx';

type Props = {
  kind: 'thread' | 'note';
  messages: Message[];
  selected: boolean;
  /** '⌥' in Source, where bare letters are typing. */
  keyPrefix: string;
  replying: boolean;
  /** Claude's reply while it's being written. */
  working?: { text: string; tool?: string };
  suggestions: SuggestionActions;
  onSelect: () => void;
  onReply: () => void;
  onResolve: () => void;
  onSend: (text: string) => Promise<boolean>;
  onCancel: () => void;
};

const who = (m: Message) => (m.author === 'claude' ? 'claude' : 'you');

/** What Claude is doing before any of its reply has arrived. */
export const activity = (tool?: string) => (tool ? `using ${tool}…` : 'thinking…');

/** Claude's reply as it streams in. */
export function LiveReply({ text, tool }: { text: string; tool?: string }) {
  return (
    <div class="message claude-working" aria-live="polite">
      <span class="message-who claude">claude</span>
      <div class="message-text">{text || activity(tool)}</div>
    </div>
  );
}

/** A thread or note in the margin: one line until selected, then the whole conversation. */
export function ThreadCard({ kind, messages, selected, keyPrefix, replying, working, suggestions, ...on }: Props) {
  const [first, ...rest] = messages;
  const last = rest.at(-1);
  const dot = (last ?? first)?.author === 'claude' ? 'dot dot-claude' : 'dot dot-calvin';

  if (!selected) {
    return (
      <div class="thread" onClick={on.onSelect}>
        <div class="thread-head">
          <span class={dot} />
          <span class="thread-first">{first?.text}</span>
        </div>
        {working ? (
          <div class="thread-sub claude-working">claude · {working.text || activity(working.tool)}</div>
        ) : (
          last && (
            <div class="thread-sub">
              {who(last)} · {last.suggestion?.status === 'open' ? 'suggested an edit' : last.text}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div class="thread thread-on">
      {messages.map((m, i) =>
        m.suggestion ? (
          <SuggestionView key={i} s={m.suggestion} reason={m.text} keyPrefix={keyPrefix} act={suggestions} />
        ) : (
          <div class="message" key={i}>
            <span class={`message-who ${m.author}`}>{who(m)}</span>
            <div class="message-text">{m.text}</div>
          </div>
        ),
      )}
      {working && <LiveReply {...working} />}
      {kind === 'note' ? (
        <div class="thread-sub">Note in the post. Edit it there.</div>
      ) : replying ? (
        <Composer label="Reply" onSend={on.onSend} onCancel={on.onCancel} />
      ) : (
        <div class="thread-actions">
          <button type="button" class="btn" onClick={on.onReply}>
            Reply<kbd class="k">{keyPrefix}R</kbd>
          </button>
          <button type="button" class="btn" onClick={on.onResolve}>
            Resolve<kbd class="k">{keyPrefix}D</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
