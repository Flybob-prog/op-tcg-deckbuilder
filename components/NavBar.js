"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Card Database" },
  { href: "/deck-builder", label: "Deck Builder" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3">
        <span className="font-semibold">OP TCG</span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm ${
              pathname === link.href
                ? "font-medium text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
