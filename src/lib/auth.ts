import { createHash } from "crypto";
import { NextRequest } from "next/server";

export const AUTH_COOKIE = "wg_auth";

function expectedToken(): string | null {
  const passcode = process.env.SETLIST_PASSCODE?.trim();
  if (!passcode) return null;
  return createHash("sha256").update(passcode).digest("hex");
}

export function isPasscodeProtected(): boolean {
  return expectedToken() !== null;
}

export function tokenForPasscode(passcode: string): string {
  return createHash("sha256").update(passcode.trim()).digest("hex");
}

export function checkPasscode(passcode: string): boolean {
  const expected = expectedToken();
  if (!expected) return true;
  return tokenForPasscode(passcode) === expected;
}

export function isAuthorized(req: NextRequest): boolean {
  const expected = expectedToken();
  if (!expected) return true; // gate disabled
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  return cookie === expected;
}
