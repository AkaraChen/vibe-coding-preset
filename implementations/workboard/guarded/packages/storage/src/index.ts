export type StorageObject = {
  body: Uint8Array;
  mimeType: string;
};

export type Storage = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<StorageObject | undefined>;
  put(key: string, body: Uint8Array, mimeType: string): Promise<void>;
};
