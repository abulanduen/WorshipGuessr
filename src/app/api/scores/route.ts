import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEADERBOARD_SIZE } from "@/lib/constants";

export async function GET() {
  const scores = await prisma.score.findMany({
    orderBy: { score: "desc" },
    take: LEADERBOARD_SIZE,
  });
  return NextResponse.json(scores.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  const score = Number(body?.score);
  const roundsPlayed = Number(body?.roundsPlayed);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Number.isFinite(score) || score < 0) return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  if (!Number.isFinite(roundsPlayed) || roundsPlayed < 0) {
    return NextResponse.json({ error: "Invalid roundsPlayed" }, { status: 400 });
  }

  const entry = await prisma.score.create({
    data: { name, score: Math.round(score), roundsPlayed: Math.round(roundsPlayed) },
  });

  return NextResponse.json({ ...entry, createdAt: entry.createdAt.toISOString() }, { status: 201 });
}
