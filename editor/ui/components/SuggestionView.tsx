import type { Suggestion } from '../../domain/suggestion.ts';
import { Composer } from './Composer.tsx';

/** What a suggestion card needs from the editor. */
export type SuggestionActions = {
  /** False once the words the suggestion replaces have changed in the post. */
  applies: (s: Suggestion) => boolean;
  /** The suggestion Calvin is tweaking, if any. */
  tweaking?: string;
  accept: (s: Suggestion, replace?: string) => Promise<boolean>;
  reject: (s: Suggestion) => void;
  tweak: (s: Suggestion) => void;
  cancelTweak: () => void;
};

/** Claude's suggested edit: the change, the reason, and what Calvin can do with it. */
export function SuggestionView({ s, reason, keyPrefix, act }: { s: Suggestion; reason: string; keyPrefix: string; act: SuggestionActions }) {
  const applies = act.applies(s);
  return (
    <div class="message">
      <span class="message-who claude">claude</span>
      <div class="suggestion">
        <span class="del">{s.find}</span> <span class="ins">{s.replace}</span>
      </div>
      {reason && <div class="message-text">{reason}</div>}
      {s.status !== 'open' ? (
        <div class="suggestion-status">{s.status === 'accepted' ? 'Accepted' : 'Rejected'}</div>
      ) : act.tweaking === s.id ? (
        <Composer label="Your version" initial={s.replace} onSend={(t) => act.accept(s, t)} onCancel={act.cancelTweak} />
      ) : (
        <>
          {!applies && <div class="suggestion-status">The words it replaces have changed.</div>}
          <div class="thread-actions">
            {applies && (
              <button type="button" class="btn btn-go" onClick={() => void act.accept(s)}>
                Accept<kbd class="k">{keyPrefix}A</kbd>
              </button>
            )}
            <button type="button" class="btn" onClick={() => act.reject(s)}>
              Reject<kbd class="k">{keyPrefix}X</kbd>
            </button>
            {applies && (
              <button type="button" class="btn" onClick={() => act.tweak(s)}>
                Tweak<kbd class="k">{keyPrefix}T</kbd>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
