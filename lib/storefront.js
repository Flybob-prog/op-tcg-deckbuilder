/**
 * Moo-Fly shop connection for the "Buy this deck" button.
 *
 * Uses Shopify's Storefront API, which is designed for exactly this: a
 * site outside Shopify showing live prices/stock and sending shoppers to
 * the real Shopify checkout. It's safe to call from the browser: the
 * Storefront token is a PUBLIC token (Shopify's own docs say so), unlike
 * the private Admin token used by lib/shopify.js.
 *
 * One-time setup (Shopify admin):
 *  1. Install the free "Headless" sales channel (Shopify App Store).
 *  2. Headless -> Create storefront -> Storefront API -> copy the
 *     "Public access token".
 *  3. Make sure the products you want buyable are Active and published to
 *     both "Online Store" and the new Headless storefront.
 *  4. In Vercel (Settings -> Environment Variables) add:
 *       NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = <your-store>.myshopify.com
 *       NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN = <the public token>
 *     then redeploy. Until both are set the buy panel simply doesn't show.
 *
 * Cards are matched to products by SKU, using the convention in the
 * project's sku-convention doc: SKU = card_image_id, uppercased, "_" -> "-"
 * (so a base printing's SKU is just its card number, e.g. "OP16-041").
 */

const API_VERSION = "2026-07";

const STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

export function isStorefrontConfigured() {
  return Boolean(STORE_DOMAIN && STOREFRONT_TOKEN);
}

/** The Shopify SKU for a card printing (see file header). */
export function skuFor(card) {
  const imageId = card.card_image_id || card.card_set_id || "";
  return imageId.toUpperCase().replace(/_/g, "-");
}

async function storefrontGraphQL(query, variables) {
  const res = await fetch(
    `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    throw new Error(
      `Shopify Storefront API error (${res.status}): ${JSON.stringify(json.errors ?? json)}`
    );
  }
  return json.data;
}

const productsQuery = (withQuantity) => `
  query DeckStock($after: String) {
    products(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        variants(first: 20) {
          nodes {
            id
            sku
            availableForSale
            ${withQuantity ? "quantityAvailable" : ""}
            price { amount currencyCode }
          }
        }
      }
    }
  }
`;

/**
 * Every buyable variant in the shop, keyed by SKU:
 *   Map<SKU, { variantId, handle, available, quantity (number|null), price, currency }>
 *
 * The whole singles catalogue is a few hundred products, so it's loaded
 * once per visit rather than looked up card by card.
 */
export async function fetchShopStock() {
  // quantityAvailable needs the "read product inventory" permission on
  // the Storefront token. If it isn't granted, fall back to just
  // availableForSale rather than failing outright.
  let withQuantity = true;
  const stock = new Map();
  let after = null;

  for (let page = 0; page < 20; page++) {
    let data;
    try {
      data = await storefrontGraphQL(productsQuery(withQuantity), { after });
    } catch (err) {
      if (withQuantity && /quantityAvailable|access ?denied/i.test(err.message)) {
        withQuantity = false;
        page -= 1;
        continue;
      }
      throw err;
    }

    for (const product of data.products.nodes) {
      for (const v of product.variants.nodes) {
        if (!v.sku) continue;
        stock.set(v.sku.toUpperCase(), {
          variantId: v.id,
          handle: product.handle,
          available: v.availableForSale,
          quantity: typeof v.quantityAvailable === "number" ? v.quantityAvailable : null,
          price: Number(v.price.amount),
          currency: v.price.currencyCode,
        });
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }

  return stock;
}

/**
 * Works out what can be bought for a deck.
 *
 * @param {object} deck - see lib/deck.js
 * @param {Map} stock - from fetchShopStock()
 * @param {object} [options]
 * @param {(card) => number} [options.getOwnedCount] - with skipOwned, buy only the copies you're missing
 * @param {boolean} [options.skipOwned]
 * @returns {{ lines, missing, buyCount, wantedCount, total, currency }}
 *   lines: [{ card, quantity, variantId, price }] - what goes in the basket
 *   missing: [{ card, short, reason }] - copies that can't be bought
 */
export function planDeckPurchase(deck, stock, { getOwnedCount, skipOwned } = {}) {
  const lines = [];
  const missing = [];
  let buyCount = 0;
  let wantedCount = 0;
  let total = 0;
  let currency = "GBP";

  const entries = [
    ...(deck.leader ? [{ card: deck.leader, count: 1 }] : []),
    ...Object.values(deck.cards),
  ];

  for (const { card, count } of entries) {
    const owned = skipOwned && getOwnedCount ? getOwnedCount(card) : 0;
    const wanted = Math.max(0, count - owned);
    if (wanted === 0) continue;
    wantedCount += wanted;

    const item = stock.get(skuFor(card)) ?? stock.get(card.card_set_id?.toUpperCase());
    if (!item || !item.available) {
      missing.push({ card, short: wanted, reason: item ? "Sold out" : "Not stocked" });
      continue;
    }

    const quantity = item.quantity === null ? wanted : Math.min(wanted, item.quantity);
    if (quantity > 0) {
      lines.push({ card, quantity, variantId: item.variantId, price: item.price });
      buyCount += quantity;
      total += quantity * item.price;
      currency = item.currency;
    }
    if (quantity < wanted) {
      missing.push({ card, short: wanted - quantity, reason: `Only ${quantity} in stock` });
    }
  }

  return { lines, missing, buyCount, wantedCount, total, currency };
}

const CART_CREATE = `
  mutation DeckCart($input: CartInput!) {
    cartCreate(input: $input) {
      cart { checkoutUrl }
      userErrors { field message }
    }
  }
`;

/** Creates a Moo-Fly basket with these lines and returns its checkout URL. */
export async function createDeckCheckout(lines, deckName) {
  const data = await storefrontGraphQL(CART_CREATE, {
    input: {
      lines: lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })),
      note: deckName ? `Deck: ${deckName} (from the Moo-Fly Deck Builder)` : undefined,
    },
  });
  const { cart, userErrors } = data.cartCreate;
  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
  return cart.checkoutUrl;
}
