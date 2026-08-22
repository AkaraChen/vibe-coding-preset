export type ActivityEvent = {
  actorId: string;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  payload: Record<string, unknown>;
  type: string;
  workspaceId: string;
};

type Listener = (event: ActivityEvent) => void;

export class ActivityHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  publish(workspaceId: string, event: ActivityEvent): void {
    const set = this.listeners.get(workspaceId);
    if (set === undefined) {
      return;
    }
    for (const listener of set) {
      listener(event);
    }
  }

  subscribe(workspaceId: string, listener: Listener): () => void {
    const current = this.listeners.get(workspaceId) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(workspaceId, current);
    return () => {
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(workspaceId);
      }
    };
  }
}
