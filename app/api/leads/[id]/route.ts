import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { STATUSES, type Status } from "@/lib/types";

/** Approve, skip, or otherwise update one lead. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { status?: string; notes?: string };
  const update: { status?: Status; notes?: string } = {};
  if (body.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Bad status" }, { status: 400 });
    }
    update.status = body.status as Status;
  }
  if (typeof body.notes === "string") update.notes = body.notes.slice(0, 2000);
  const { data, error } = await db().from("leads").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
