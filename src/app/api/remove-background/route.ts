import { removeBackground } from "@imgly/background-removal-node";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    // Process the image
    const blob = await removeBackground(imageUrl, {
      debug: false,
      model: "isnet",
      output: {
        quality: 0.8,
        format: "image/png",
      },
    });

    // Convert blob to base64
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:image/png;base64,${buffer.toString("base64")}`;

    return NextResponse.json({ imageData: base64 });
  } catch (error) {
    console.error("Error removing background:", error);
    return NextResponse.json(
      { error: "Failed to remove background" },
      { status: 500 }
    );
  }
}
