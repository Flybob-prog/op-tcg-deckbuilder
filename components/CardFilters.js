"use client";

/**
 * Controlled filter bar: name/trait search + color/cost/type dropdowns.
 * All state lives in the parent (app/page.js) — this component just
 * renders inputs and calls the passed-in setters. Options for the
 * dropdowns are derived from the actual loaded card data, so we never
 * hardcode a color/type list that could drift out of date as new sets
 * release.
 *
 * Trait/affiliation (e.g. "Straw Hat Crew", "Whitebeard Pirates") is a
 * text search rather than a dropdown — see the comment in
 * lib/optcg.js's filterCards for why we can't reliably enumerate exact
 * trait values.
 */
export default function CardFilters({
  filters,
  onChange,
  colorOptions,
  typeOptions,
  costOptions,
  printTagOptions,
  rarityOptions,
  resultCount,
}) {
  function update(field, value) {
    onChange({ ...filters, [field]: value });
  }

  function clearAll() {
    onChange({
      name: "",
      color: "",
      cost: "",
      type: "",
      trait: "",
      printTag: "",
      rarity: "",
    });
  }

  const hasActiveFilters =
    filters.name ||
    filters.color ||
    filters.cost ||
    filters.type ||
    filters.trait ||
    filters.printTag ||
    filters.rarity;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Name / Card ID
          </span>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Buggy or OP16-041"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>

        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Trait / Affiliation
          </span>
          <input
            type="text"
            value={filters.trait}
            onChange={(e) => update("trait", e.target.value)}
            placeholder="e.g. Straw Hat Crew"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Color
          </span>
          <select
            value={filters.color}
            onChange={(e) => update("color", e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">Any</option>
            {colorOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Cost
          </span>
          <select
            value={filters.cost}
            onChange={(e) => update("cost", e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">Any</option>
            {costOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Type
          </span>
          <select
            value={filters.type}
            onChange={(e) => update("type", e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">Any</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Print
          </span>
          <select
            value={filters.printTag}
            onChange={(e) => update("printTag", e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">Any</option>
            {printTagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Rarity
          </span>
          <select
            value={filters.rarity}
            onChange={(e) => update("rarity", e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">Any</option>
            {rarityOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {resultCount} card{resultCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
