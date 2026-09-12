import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, checkPasscode, isAuthorized, isPasscodeProtected, tokenForPasscode } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return NextResponse.json({ protected: isPasscodeProtected(), authorized: isAuthorized(req) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";

  if (!checkPasscode(passcode)) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  if (isPasscodeProtected()) {
    res.cookies.set(AUTH_COOKIE, tokenForPasscode(passcode), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return res;
}
