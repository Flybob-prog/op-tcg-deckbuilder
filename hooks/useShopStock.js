"use client";

import { useEffect, useState } from "react";
import { fetchShopStock, isStorefrontConfigured } from "@/lib/storefront";

/**
 * Loads the Moo-Fly shop's stock once (see lib/storefront.js).
 * status: "off" (shop not connected) | "loading" | "ready" | "error"
 */
export function useShopStock() {
  const configured = isStorefrontConfigured();
  const [stock, setStock] = useState(null);
  const [status, setStatus] = useState(configured ? "loading" : "off");

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    fetchShopStock()
      .then((s) => {
        if (!cancelled) {
          setStock(s);
          setStatus("ready");
        }
      })
      .catch((err) => {
        console.error("Couldn't load Moo-Fly stock:", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  return { stock, status };
}
