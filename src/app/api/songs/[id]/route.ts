import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { deleteSongFile } from "@/lib/songs";
import { normalizeKey } from "@/lib/filename-parse";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title;
  const artist = typeof body.artist === "string" ? body.artist.trim() || null : existing.artist;
  const key = normalizeKey(title, artist);

  const conflict = await prisma.song.findFirst({ where: { normalizedKey: key, NOT: { id } } });
  if (conflict) return NextResponse.json({ error: "Another song already has this title and artist" }, { status: 409 });

  const song = await prisma.song.update({ where: { id }, data: { title, artist, normalizedKey: key } });
  return NextResponse.json({ ...song, addedAt: song.addedAt.toISOString() });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Passcode required" }, { status: 401 });
  const { id } = await params;

  const song = await prisma.song.findUnique({ where: { id } });
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  await prisma.song.delete({ where: { id } });
  await deleteSongFile(song.audioUrl).catch(() => {});

  return NextResponse.json({ ok: true });
}
