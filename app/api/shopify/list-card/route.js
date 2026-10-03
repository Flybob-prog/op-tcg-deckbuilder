import { NextResponse } from "next/server";
import { createCardListing } from "@/lib/shopify";

/**
 * Creates a DRAFT Shopify product for one spare physical card (see
 * lib/shopify.js for the Admin API call itself and the one-time setup
 * this needs). Called from the "List for sale" button on the
 * Collection page (app/collection/page.js) — kept as a server route
 * rather than calling lib/shopify.js from the client because it needs
 * your private Shopify Admin API token, which must never reach the
 * browser (see the comment at the top of lib/shopify.js).
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { card, quantity, price } = body ?? {};

  if (!card?.card_set_id || !card?.card_name) {
    return NextResponse.json(
      { error: "A card (with at least card_set_id and card_name) is required." },
      { status: 400 }
    );
  }

  const numericQuantity = Number(quantity);
  if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
    return NextResponse.json(
      { error: "quantity must be a whole number of 1 or more." },
      { status: 400 }
    );
  }

  if (typeof price !== "string" || !/^\d+(\.\d{1,2})?$/.test(price)) {
    return NextResponse.json(
      { error: 'price must be a decimal string, e.g. "2.50".' },
      { status: 400 }
    );
  }

  try {
    const listing = await createCardListing(card, numericQuantity, price);
    return NextResponse.json({ listing });
  } catch (error) {
    console.error("Failed to create Shopify listing:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create the Shopify listing." },
      { status: 502 }
    );
  }
}
