"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Card Database" },
  { href: "/collection", label: "My Collection" },
  { href: "/deck-builder", label: "Deck Builder" },
  { href: "/recommended-decks", label: "Recommended Decks" },
  { href: "/starter-decks", label: "Starter Decks" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b-2 border-moo-gold bg-moo-navy text-moo-parchment">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
        <Link href="/" className="mr-2 flex items-center gap-3" aria-label="Moo-Fly deck builder home">
          <Image
            src="/brand/moofly-badge.svg"
            alt=""
            width={48}
            height={48}
            unoptimized
            priority
          />
          <Image
            src="/brand/moofly-nameplate.svg"
            alt="Moo-Fly"
            width={154}
            height={32}
            unoptimized
            priority
          />
        </Link>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`border-b-2 py-1 text-sm ${
                active
                  ? "border-moo-gold font-semibold text-moo-gold"
                  : "border-transparent text-moo-parchment/80 hover:text-moo-parchment"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
