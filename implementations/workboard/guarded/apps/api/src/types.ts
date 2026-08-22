import type { Database } from "@workboard/db";
import type { Storage } from "@workboard/storage";
import type { ActivityHub } from "./hub.ts";

export type Actor = {
  id: string;
  email: string;
  name: string;
};

export type AppVariables = {
  actor: Actor | undefined;
  requestId: string;
  sessionId: string | undefined;
};

export type AppDeps = {
  cookieSecure: boolean;
  db: Database;
  hub: ActivityHub;
  now: () => Date;
  storage: Storage;
  webOrigin: string;
};
