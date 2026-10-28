import "./globals.css";
import { Zilla_Slab } from "next/font/google";
import NavBar from "@/components/NavBar";

const zillaSlab = Zilla_Slab({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-zilla",
});

export const metadata = {
  title: "Moo-Fly Deck Builder",
  description:
    "Browse the One Piece Trading Card Game database and build decks, from Moo-Fly Trading Card Decks & Singles.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${zillaSlab.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
