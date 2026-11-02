/**
 * Músicas do próprio celular, guardadas no aparelho (IndexedDB).
 *
 * Arquivos de áudio não cabem no localStorage (limite de ~5 MB), e o Spotify não
 * permite que outro app controle a reprodução dele. Com os arquivos guardados
 * aqui, o Pulso é dono do áudio: toca durante o treino, funciona offline e pode
 * **abaixar a música** na hora do sinal.
 */

export interface Track {
  id: string;
  name: string;
  /** Ordem em que foi adicionada (a lista não pode embaralhar sozinha). */
  addedAt: number;
  blob: Blob;
}

const DB_NAME = "pulso-music";
const STORE = "tracks";
const DB_VERSION = 1;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Nome limpo: sem caminho e sem extensão. */
export function trackTitle(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.replace(/\.[a-z0-9]{2,5}$/i, "").trim() || base;
}

export async function listTracks(): Promise<Track[]> {
  if (!hasIndexedDb()) return [];
  try {
    const db = await openDb();
    return await new Promise<Track[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => {
        const tracks = (request.result as Track[]).sort((a, b) => a.addedAt - b.addedAt);
        resolve(tracks);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/** Guarda os arquivos escolhidos. Arquivos que não são áudio são ignorados. */
export async function addTracks(files: File[]): Promise<Track[]> {
  const audioFiles = files.filter((file) => file.type === "" || file.type.startsWith("audio/"));
  if (!hasIndexedDb() || audioFiles.length === 0) return listTracks();
  try {
    const db = await openDb();
    const now = Date.now();
    const tracks: Track[] = audioFiles.map((file, position) => ({
      id: newId(),
      name: trackTitle(file.name),
      addedAt: now + position,
      blob: file,
    }));
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      for (const track of tracks) store.put(track);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    return listTracks();
  } catch {
    return listTracks();
  }
}

export async function clearTracks(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Sem IndexedDB (navegação privada): a lista simplesmente não persiste.
  }
}
