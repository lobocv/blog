import { type Message, PAGE } from '../../domain/thread.ts';
import type { ThreadState } from '../thread-state.ts';
import { Composer } from './Composer.tsx';
import { LiveReply } from './ThreadCard.tsx';

const who = (m: Message) => (m.author === 'claude' ? 'claude' : 'you');

function Messages({ messages }: { messages: Message[] }) {
  return (
    <>
      {messages.map((m, i) => (
        <div class="message" key={i}>
          <span class={`message-who ${m.author}`}>{who(m)}</span>
          <div class="message-text">{m.text}</div>
        </div>
      ))}
    </>
  );
}

/** Comments on the whole post, and threads that lost their place when their words were edited away. */
export function PageThread({ state, onClose }: { state: ThreadState; onClose: () => void }) {
  const review = state.page.value?.review;
  return (
    <aside class="page-thread" aria-label="Page thread">
      <div class="page-thread-head">
        <div class="page-thread-row">
          <span class="page-thread-title">Page</span>
          {review && (
            <span class="page-thread-review">
              {review.title} · {review.done} of {review.total}
            </span>
          )}
          <kbd class="k">esc</kbd>
        </div>
        {review && (
          <div class="segments" aria-hidden="true">
            {Array.from({ length: review.total }, (_, i) => (
              <span key={i} class={`seg${i < review.done ? ' done' : i === review.done ? ' now' : ''}`} />
            ))}
          </div>
        )}
      </div>
      <div class="page-thread-body">
        {state.lost.value.map((t) => (
          <div class="lost" key={t.id}>
            <div class="lost-quote">Lost its place: “{t.anchor!.quote}”</div>
            <Messages messages={t.messages} />
            <button
              type="button"
              class="btn"
              onClick={() => {
                state.selected.value = t.id;
                void state.resolveSelected();
              }}
            >
              Resolve
            </button>
          </div>
        ))}
        <Messages messages={state.page.value?.messages ?? []} />
        {state.working.value?.threadId === PAGE && <LiveReply {...state.working.value} />}
      </div>
      {state.error.value && <p class="margin-error">{state.error.value}</p>}
      <div class="page-thread-compose">
        <Composer label="Message about the whole page" onSend={(t) => {
            state.composing.value = { kind: 'page' };
            return state.send(t);
          }} onCancel={onClose} />
      </div>
    </aside>
  );
}
