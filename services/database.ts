import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("photosearch.db");

export interface Photo {
  id: number;
  uri: string;
  filename: string;
  description: string;
  tags: string;
  indexed: number;
}

export interface Collection {
  id: number;
  name: string;
  created_at: string;
}

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uri TEXT UNIQUE,
      filename TEXT,
      description TEXT,
      tags TEXT,
      indexed INTEGER DEFAULT 0
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS collection_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      photo_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(collection_id, photo_id),
      FOREIGN KEY(collection_id) REFERENCES collections(id),
      FOREIGN KEY(photo_id) REFERENCES photos(id)
    );
  `);
}

export function savePhoto(
  uri: string,
  filename: string,
  description: string,
  tags: string[],
): void {
  db.runSync(
    `INSERT OR REPLACE INTO photos (uri, filename, description, tags, indexed)
     VALUES (?, ?, ?, ?, 1)`,
    [uri, filename, description, tags.join(",")],
  );
}

export function searchPhotos(query: string): Photo[] {
  const q = `%${query.toLowerCase()}%`;
  return db.getAllSync<Photo>(
    `SELECT * FROM photos 
     WHERE (LOWER(description) LIKE ? 
     OR LOWER(tags) LIKE ?)
     AND indexed = 1`,
    [q, q],
  );
}

export function getAllPhotos(): Photo[] {
  return db.getAllSync<Photo>(
    `SELECT * FROM photos
     WHERE indexed = 1
     ORDER BY id DESC`,
  );
}

export function isIndexed(uri: string): boolean {
  const result = db.getFirstSync<{ id: number }>(
    `SELECT id FROM photos WHERE uri = ? AND indexed = 1`,
    [uri],
  );
  return !!result;
}

export function getIndexedCount(): number {
  const result = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM photos WHERE indexed = 1`,
  );
  return result?.count ?? 0;
}

export function createCollection(name: string): void {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Collection name cannot be empty");
  }

  db.runSync(
    `INSERT OR IGNORE INTO collections (name)
     VALUES (?)`,
    [trimmedName],
  );
}

export function getCollections(): Collection[] {
  return db.getAllSync<Collection>(
    `SELECT * FROM collections
     ORDER BY created_at DESC`,
  );
}

export function addPhotoToCollection(
  photoId: number,
  collectionId: number,
): void {
  db.runSync(
    `INSERT OR IGNORE INTO collection_photos (photo_id, collection_id)
     VALUES (?, ?)`,
    [photoId, collectionId],
  );
}

export function getPhotosInCollection(collectionId: number): Photo[] {
  return db.getAllSync<Photo>(
    `SELECT photos.*
     FROM photos
     INNER JOIN collection_photos
       ON photos.id = collection_photos.photo_id
     WHERE collection_photos.collection_id = ?
     ORDER BY collection_photos.created_at DESC`,
    [collectionId],
  );
}
