import type {
  SessionStorageBackend,
  StoredSession,
} from '@nhost/nhost-js/session';
import * as SecureStore from 'expo-secure-store';
import {
  MAX_SESSION_CHUNKS,
  SECURE_STORE_OPTIONS,
  SESSION_CHUNK_KEYS,
  SESSION_KEY,
  SESSION_SLOTS,
  type SessionSlot,
  sessionChunkKey,
} from '@/lib/deviceStore';

/** The largest value SecureStore takes without warning that it may fail. */
export const MAX_CHUNK_BYTES = 2048;

interface Header {
  slot: SessionSlot;
  count: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** `text` cut into pieces of at most `maxBytes` in UTF-8, between characters. */
export function splitUtf8(text: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  const bytes = encoder.encode(text);
  const chunks: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + maxBytes, bytes.length);
    // Back off continuation bytes (10xxxxxx) to the start of a character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
  }
  return chunks;
}

function parseHeader(value: string): Header {
  const header = JSON.parse(value) as Partial<Header>;
  const { slot, count } = header;
  if (
    !SESSION_SLOTS.includes(slot as SessionSlot) ||
    !Number.isInteger(count) ||
    (count as number) < 1 ||
    (count as number) > MAX_SESSION_CHUNKS
  ) {
    throw new Error(`Invalid session header: ${value}`);
  }
  return header as Header;
}

function isSession(value: unknown): value is StoredSession {
  const session = value as Partial<StoredSession> | null;
  return (
    typeof session?.accessToken === 'string' &&
    typeof session.refreshToken === 'string'
  );
}

/**
 * Keeps the session in SecureStore, synchronously as the SDK reads it. A
 * session is larger than one SecureStore value, so it is split into chunks
 * under fixed keys in two slots used in turn, and the header naming the slot
 * is written last: a write cut short leaves the previous session whole. Keys
 * are cleared by writing '', never deleted (see `deviceStore.ts`).
 */
export class SecureStoreStorage implements SessionStorageBackend {
  private cache: StoredSession | null | undefined;

  private header: Header | null | undefined;

  // Chunk keys that may hold a value. Unknown at launch, so all of them.
  private readonly filled = new Set(SESSION_CHUNK_KEYS);

  get(): StoredSession | null {
    if (this.cache === undefined) {
      this.cache = this.read();
    }
    return this.cache;
  }

  // A session the device would not take is still this process's session, so
  // the app stays signed in until it quits.
  set(value: StoredSession): void {
    this.cache = value;
    try {
      this.write(value);
    } catch (err) {
      console.error('Could not keep the session on the device:', err);
    }
  }

  remove(): void {
    this.cache = null;
    try {
      this.clear();
    } catch (err) {
      console.error('Could not clear the session from the device:', err);
    }
  }

  private read(): StoredSession | null {
    try {
      const value = SecureStore.getItem(SESSION_KEY, SECURE_STORE_OPTIONS);
      if (!value) {
        this.header = null;
        return null;
      }
      const header = parseHeader(value);
      let json = '';
      for (let index = 0; index < header.count; index += 1) {
        const chunk = SecureStore.getItem(
          sessionChunkKey(header.slot, index),
          SECURE_STORE_OPTIONS,
        );
        if (!chunk) {
          throw new Error(`Session chunk ${index} of ${header.count} is gone`);
        }
        json += chunk;
      }
      const session: unknown = JSON.parse(json);
      if (!isSession(session)) {
        throw new Error('The stored value is not a session');
      }
      this.header = header;
      return session;
    } catch (err) {
      console.error('Could not read the stored session, clearing it:', err);
      this.remove();
      return null;
    }
  }

  private write(value: StoredSession): void {
    const chunks = splitUtf8(JSON.stringify(value));
    if (chunks.length > MAX_SESSION_CHUNKS) {
      throw new Error(
        `The session needs ${chunks.length} chunks, more than ${MAX_SESSION_CHUNKS}`,
      );
    }

    const slot: SessionSlot = this.currentHeader()?.slot === 'a' ? 'b' : 'a';
    const keys = chunks.map((chunk, index) => {
      const key = sessionChunkKey(slot, index);
      SecureStore.setItem(key, chunk, SECURE_STORE_OPTIONS);
      this.filled.add(key);
      return key;
    });
    const header: Header = { slot, count: chunks.length };
    SecureStore.setItem(
      SESSION_KEY,
      JSON.stringify(header),
      SECURE_STORE_OPTIONS,
    );
    this.header = header;
    this.clearChunks(keys);
  }

  private clear(): void {
    SecureStore.setItem(SESSION_KEY, '', SECURE_STORE_OPTIONS);
    this.header = null;
    this.clearChunks([]);
  }

  private clearChunks(keep: string[]): void {
    for (const key of this.filled) {
      if (!keep.includes(key)) {
        SecureStore.setItem(key, '', SECURE_STORE_OPTIONS);
        this.filled.delete(key);
      }
    }
  }

  private currentHeader(): Header | null {
    if (this.header === undefined) {
      try {
        const value = SecureStore.getItem(SESSION_KEY, SECURE_STORE_OPTIONS);
        this.header = value ? parseHeader(value) : null;
      } catch {
        this.header = null;
      }
    }
    return this.header;
  }
}
