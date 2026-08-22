import type { FC } from "react";

export const LoadingState: FC = () => (
  <p data-testid="loading-state" className="p-4 text-neutral-600">
    Loading…
  </p>
);

export const EmptyState: FC<{ message?: string | undefined }> = ({
  message = "Nothing here yet.",
}) => (
  <p data-testid="empty-state" className="p-4 text-neutral-600">
    {message}
  </p>
);

export const ErrorState: FC<{ onRetry?: (() => void) | undefined }> = ({
  onRetry,
}) => (
  <div data-testid="error-state" role="alert" className="p-4">
    <p>Something went wrong.</p>
    {onRetry ? (
      <button type="button" className="mt-2 underline" onClick={onRetry}>
        Retry
      </button>
    ) : null}
  </div>
);

export const ForbiddenState: FC = () => (
  <p data-testid="forbidden-state" role="alert" className="p-4">
    You do not have permission to do that.
  </p>
);

export const ConflictBanner: FC<{ onReload: () => void }> = ({ onReload }) => (
  <div
    data-testid="conflict-banner"
    role="alert"
    className="mb-4 border border-amber-500 bg-amber-50 p-3"
  >
    <p>This task changed in another session.</p>
    <button type="button" className="mt-2 underline" onClick={onReload}>
      Reload
    </button>
  </div>
);
