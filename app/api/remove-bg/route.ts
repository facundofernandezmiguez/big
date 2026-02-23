import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Remove.bg API key not configured" },
        { status: 500 }
      );
    }

    const body = new FormData();
    body.append("image_file", file);
    body.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Remove.bg error: ${error}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (err) {
    console.error("remove-bg route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
