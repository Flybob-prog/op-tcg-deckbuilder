/**
 * Server-only Shopify Admin API client for creating/removing draft product
 * listings for spare physical cards from your collection (see
 * lib/collection.js and app/collection/page.js). NEVER import this from a
 * "use client" file or component — it reads a private Admin API access
 * token from server-side environment variables, and that token must never
 * reach the browser. It's only ever called from app/api/shopify/* route
 * handlers, which run server-side.
 *
 * One-time setup, in your Shopify admin:
 *  1. Settings -> Apps and sales channels -> Develop apps -> Create an app.
 *  2. Configure Admin API scopes: write_products, read_products,
 *     read_locations, read_inventory, read_markets_home — this is the
 *     exact set needed by the operations below, confirmed against the
 *     live Shopify GraphQL schema while building this (nothing extra).
 *  3. Install the app, then reveal its Admin API access token.
 *  4. Add to .env.local (never commit this file — see .env.local.example
 *     in the project root, and confirm .env.local is in .gitignore):
 *       SHOPIFY_STORE_DOMAIN=your-store.myshopify.com   (the *.myshopify.com
 *         domain from your admin URL — NOT your storefront domain, e.g.
 *         NOT moofly.co.uk)
 *       SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
 *
 * Every listing is created as a DRAFT product — never published/visible to
 * customers automatically. You still need to review, price-check, and
 * publish it yourself in Shopify admin before it's actually for sale; this
 * just saves the data entry of title/image/SKU/starting stock.
 */

const API_VERSION = "2025-01"; // keep in step with Shopify's supported version window

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. See the setup instructions at the top of lib/shopify.js.`
    );
  }
  return value;
}

async function shopifyGraphQL(query, variables) {
  const domain = requireEnv("SHOPIFY_STORE_DOMAIN");
  const token = requireEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");

  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );

  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Shopify API error: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data;
}

function collectUserErrors(data) {
  return Object.values(data ?? {}).flatMap((value) => value?.userErrors ?? []);
}

// The location to stock new listings at. Cached for the life of the server
// process (same idea as allCardsCache in lib/optcg.js) since a store's
// primary location essentially never changes mid-session.
let primaryLocationCache = null;

async function getPrimaryLocationId() {
  if (primaryLocationCache) return primaryLocationCache;

  const data = await shopifyGraphQL(
    `query PrimaryLocation {
      locations(first: 1) {
        edges { node { id } }
      }
    }`
  );

  const locationId = data.locations.edges[0]?.node.id;
  if (!locationId) {
    throw new Error("Shopify store has no locations to stock inventory at.");
  }

  primaryLocationCache = locationId;
  return locationId;
}

// productSet (rather than the older productCreate + a separate variant
// update call) creates the product AND its single variant's price/SKU/
// stock in one atomic call — verified against the live Shopify Admin
// GraphQL schema and test-run against a real store while building this.
// The "Title" / "Default Title" option pairing below is the standard
// Shopify convention for a product with no real variant options (the
// same thing the classic REST API does automatically).
const CREATE_LISTING_MUTATION = `
  mutation CreateCardListing($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product {
        id
        handle
        variants(first: 1) {
          nodes { id price sku inventoryQuantity }
        }
      }
      userErrors { field message }
    }
  }
`;

/**
 * Creates a DRAFT Shopify product for one spare physical card.
 *
 * @param {Object} card - a card object, shape documented in lib/optcg.js
 * @param {number} quantity - how many spare copies you're listing
 * @param {string} price - a decimal string (e.g. "2.50") in the store's currency
 * @returns {{ productId: string, handle: string, adminUrl: string }}
 */
export async function createCardListing(card, quantity, price) {
  const locationId = await getPrimaryLocationId();
  const domain = requireEnv("SHOPIFY_STORE_DOMAIN");

  const data = await shopifyGraphQL(CREATE_LISTING_MUTATION, {
    input: {
      title: `${card.card_name} (${card.card_set_id}) — One Piece TCG`,
      productType: "TCG Single Card",
      vendor: "One Piece Card Game",
      tags: ["One Piece TCG", card.card_set_id, card.rarity].filter(Boolean),
      status: "DRAFT",
      files: card.card_image
        ? [
            {
              originalSource: card.card_image,
              contentType: "IMAGE",
              alt: card.card_name,
            },
          ]
        : [],
      productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
      variants: [
        {
          optionValues: [{ optionName: "Title", name: "Default Title" }],
          price,
          sku: card.card_set_id,
          inventoryPolicy: "DENY",
          inventoryItem: { tracked: true },
          inventoryQuantities: [{ locationId, name: "available", quantity }],
        },
      ],
    },
  });

  const userErrors = collectUserErrors(data);
  if (userErrors.length > 0) {
    throw new Error(`Shopify rejected the listing: ${JSON.stringify(userErrors)}`);
  }

  const product = data.productSet.product;
  const numericId = product.id.split("/").pop();
  const shopSubdomain = domain.replace(/\.myshopify\.com$/, "");

  return {
    productId: product.id,
    handle: product.handle,
    adminUrl: `https://${shopSubdomain}.myshopify.com/admin/products/${numericId}`,
  };
}

const DELETE_LISTING_MUTATION = `
  mutation DeleteCardListing($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors { field message }
    }
  }
`;

/** Deletes a previously-created listing (used when you "unlist" a card). */
export async function deleteCardListing(productId) {
  const data = await shopifyGraphQL(DELETE_LISTING_MUTATION, {
    input: { id: productId },
  });

  const userErrors = collectUserErrors(data);
  if (userErrors.length > 0) {
    throw new Error(`Shopify rejected the deletion: ${JSON.stringify(userErrors)}`);
  }
}
