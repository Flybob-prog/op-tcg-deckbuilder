"use client";

import { useEffect, useState } from "react";

/**
 * Fetches the full card list from our own /api/cards route (which in
 * turn goes through lib/optcg.js — see that file for why nothing calls
 * optcgapi.com directly). Shared by every page that needs the card
 * list, so the loading/error handling only lives in one place.
 */
export function useCards() {
  const [allCards, setAllCards] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      try {
        const res = await fetch("/api/cards");
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) {
          setAllCards(data.cards ?? []);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) setStatus("error");
      }
    }

    loadCards();
    return () => {
      cancelled = true;
    };
  }, []);

  return { allCards, status };
}
