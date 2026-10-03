import { NextResponse } from "next/server";
import { deleteCardListing } from "@/lib/shopify";

/**
 * Deletes a previously-created Shopify listing (see lib/shopify.js).
 * Called from the "Unlist" button on the Collection page.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { productId } = body ?? {};
  if (!productId) {
    return NextResponse.json(
      { error: "productId is required." },
      { status: 400 }
    );
  }

  try {
    await deleteCardListing(productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete Shopify listing:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove the Shopify listing." },
      { status: 502 }
    );
  }
}
