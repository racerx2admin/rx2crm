import { NextResponse } from "next/server";
import { AUTH_COOKIE, passwordToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = process.env.APP_PASSWORD;
  if (!password || form.get("password") !== password) {
    return NextResponse.redirect(new URL("/login?wrong=1", req.url), 303);
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(AUTH_COOKIE, await passwordToken(password), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
