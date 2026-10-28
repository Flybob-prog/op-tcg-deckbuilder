"use client";

import { useMemo, useState } from "react";
import { useShopStock } from "@/hooks/useShopStock";
import { createDeckCheckout, planDeckPurchase } from "@/lib/storefront";

/**
 * "Buy this deck from Moo-Fly": matches the deck's cards to Moo-Fly shop
 * listings (lib/storefront.js), shows what's in stock and the total,
 * and sends the shopper to Shopify checkout with everything in the
 * basket. Renders nothing until the shop is connected (see the setup
 * steps at the top of lib/storefront.js).
 */
export default function BuyDeckPanel({ deck, getOwnedCount }) {
  const { stock, status } = useShopStock();
  const [skipOwned, setSkipOwned] = useState(false);
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | working | error
  const [errorText, setErrorText] = useState("");
  const [showMissing, setShowMissing] = useState(false);

  const plan = useMemo(
    () =>
      stock
        ? planDeckPurchase(deck, stock, { getOwnedCount, skipOwned })
        : null,
    [deck, stock, getOwnedCount, skipOwned]
  );

  if (status === "off" || !deck.leader) return null;

  const money = (n, currency = "GBP") =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);

  async function handleBuy() {
    setCheckoutState("working");
    setErrorText("");
    try {
      const url = await createDeckCheckout(plan.lines, deck.leader?.card_name);
      window.location.href = url;
    } catch (err) {
      console.error("Checkout failed:", err);
      setErrorText(err.message);
      setCheckoutState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm font-semibold">Buy this deck from Moo-Fly</p>

      {status === "loading" && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Checking stock&hellip;</p>
      )}
      {status === "error" && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Couldn&apos;t reach the Moo-Fly shop right now. Try again later.
        </p>
      )}

      {status === "ready" && plan && (
        <>
          {getOwnedCount && (
            <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={skipOwned}
                onChange={(e) => setSkipOwned(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Only buy copies I don&apos;t own yet
            </label>
          )}

          {plan.wantedCount === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {skipOwned ? "You already own every card in this deck." : "Add some cards first."}
            </p>
          ) : (
            <>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                <span className="font-medium">{plan.buyCount}</span> of {plan.wantedCount} cards
                in stock
                {plan.buyCount > 0 && <> &middot; {money(plan.total, plan.currency)}</>}
              </p>

              <button
                type="button"
                onClick={handleBuy}
                disabled={plan.buyCount === 0 || checkoutState === "working"}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {checkoutState === "working"
                  ? "Opening checkout…"
                  : plan.buyCount === 0
                    ? "None of these are in stock yet"
                    : `Buy ${plan.buyCount} card${plan.buyCount === 1 ? "" : "s"} · ${money(plan.total, plan.currency)}`}
              </button>

              {checkoutState === "error" && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Couldn&apos;t create the basket: {errorText}
                </p>
              )}

              {plan.missing.length > 0 && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  <button
                    type="button"
                    onClick={() => setShowMissing((s) => !s)}
                    className="underline"
                  >
                    {plan.missing.reduce((n, m) => n + m.short, 0)} cards not available
                    {showMissing ? " (hide)" : " (show)"}
                  </button>
                  {showMissing && (
                    <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                      {plan.missing.map(({ card, short, reason }) => (
                        <li key={card.card_set_id}>
                          {short}x {card.card_name}: {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Prices and stock are confirmed at checkout.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
