import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const FROM_NAME = "Mosaic Music";
const FROM_EMAIL = "info@mosaicmusic.co.uk";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase env vars are missing." },
        { status: 500 }
      );
    }

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is missing." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }

    const body = await request.json();

    const toEmail =
      typeof body.toEmail === "string" ? body.toEmail.trim() : "";
    const subject =
      typeof body.subject === "string" ? body.subject.trim() : "";
    const textBody =
      typeof body.textBody === "string" ? body.textBody.trim() : "";
    const bccMyself = Boolean(body.bccMyself);

    if (!toEmail) {
      return NextResponse.json({ error: "Recipient email is required." }, { status: 400 });
    }

    if (!subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }

    if (!textBody) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const bccEmail = bccMyself ? user.email ?? null : null;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [toEmail],
        bcc: bccEmail ? [bccEmail] : undefined,
        subject,
        text: textBody,
      }),
    });

    const resendJson = await resendResponse.json();

    if (!resendResponse.ok) {
      const message =
        typeof resendJson?.message === "string"
          ? resendJson.message
          : "Failed to send email.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      resendEmailId: resendJson.id,
      fromName: FROM_NAME,
      fromEmail: FROM_EMAIL,
      toEmail,
      bccEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error sending email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}