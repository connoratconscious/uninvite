// lib/store.ts
import crypto from 'crypto';

type Record = { data: Buffer; mime: string; createdAt: number };

const store = new Map<string, Record>();

export function putImage(buf: Buffer, mime: string) {
  const id = crypto.randomUUID();
  store.set(id, { data: buf, mime, createdAt: Date.now() });
  return id;
}

export function getImage(id: string) {
  return store.get(id) || null;
}

export function deleteImage(id: string) {
  store.delete(id);
}