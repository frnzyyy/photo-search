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
