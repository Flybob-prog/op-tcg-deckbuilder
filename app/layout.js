import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata = {
  title: "OP TCG Deck Builder",
  description: "Browse and search the One Piece Trading Card Game database.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
