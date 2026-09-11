/*
  Warnings:

  - Added the required column `normalizedKey` to the `Song` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Song" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "audioUrl" TEXT NOT NULL,
    "duration" REAL,
    "normalizedKey" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Song" ("addedAt", "artist", "audioUrl", "duration", "id", "title") SELECT "addedAt", "artist", "audioUrl", "duration", "id", "title" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
CREATE UNIQUE INDEX "Song_normalizedKey_key" ON "Song"("normalizedKey");
CREATE INDEX "Song_title_idx" ON "Song"("title");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
