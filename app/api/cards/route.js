import { NextResponse } from "next/server";
import { getAllCards } from "@/lib/optcg";

/**
 * Route handler that exposes the card database to the browser.
 *
 * The client (app/page.js) fetches from here, NOT from optcgapi.com
 * directly. Reasons:
 *  - Every card fetch goes through lib/optcg.js, so there's exactly one
 *    place that knows about the external API (see lib/optcg.js).
 *  - Next.js caches the upstream fetch (see CACHE_SECONDS in lib/optcg.js),
 *    so repeat visits don't hit optcgapi.com again until the cache expires.
 *  - If we swap data sources later, only lib/optcg.js changes.
 */
export async function GET() {
  try {
    const cards = await getAllCards();
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Failed to load cards:", error);
    return NextResponse.json(
      { error: "Failed to load card data. Please try again shortly." },
      { status: 502 }
    );
  }
}
