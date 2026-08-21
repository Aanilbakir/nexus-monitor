import type { Messages } from '../i18n/messages';

export function LoadingState({ copy }: { readonly copy: Messages }) {
  return (
    <div className="state-view" role="status">
      <span className="state-code">00:01</span>
      <h1>{copy.loading}</h1>
      <div className="loading-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function EmptyState({ copy }: { readonly copy: Messages }) {
  return (
    <div className="state-view">
      <span className="state-code">NO_HOSTS</span>
      <h1>{copy.emptyTitle}</h1>
      <p>{copy.emptyDescription}</p>
    </div>
  );
}

export function ErrorState({
  copy,
  retry,
}: {
  readonly copy: Messages;
  readonly retry: () => void;
}) {
  return (
    <div className="state-view state-error" role="alert">
      <span className="state-code">ERR_SNAPSHOT</span>
      <h1>{copy.errorTitle}</h1>
      <p>{copy.errorDescription}</p>
      <button className="action-button" type="button" onClick={retry}>
        {copy.retry}
      </button>
    </div>
  );
}
