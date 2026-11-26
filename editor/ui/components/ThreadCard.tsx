import type { Message } from '../../domain/thread.ts';
import { Composer } from './Composer.tsx';

type Props = {
  kind: 'thread' | 'note';
  messages: Message[];
  selected: boolean;
  /** '⌥' in Source, where bare letters are typing. */
  keyPrefix: string;
  replying: boolean;
  onSelect: () => void;
  onReply: () => void;
  onResolve: () => void;
  onSend: (text: string) => Promise<boolean>;
  onCancel: () => void;
};

const who = (m: Message) => (m.author === 'claude' ? 'claude' : 'you');

/** A thread or note in the margin: one line until selected, then the whole conversation. */
export function ThreadCard({ kind, messages, selected, keyPrefix, replying, ...on }: Props) {
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
        {last && (
          <div class="thread-sub">
            {who(last)} · {last.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div class="thread thread-on">
      {messages.map((m, i) => (
        <div class="message" key={i}>
          <span class={`message-who ${m.author}`}>{who(m)}</span>
          <div class="message-text">{m.text}</div>
        </div>
      ))}
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
