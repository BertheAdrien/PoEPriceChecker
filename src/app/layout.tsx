import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600", "700", "900"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "PoE Price Checker",
  description: "Arbitrages Path of Exile 1 classés par marge",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${cinzel.variable} ${cormorant.variable} ${plex.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col text-sm">
        {/* Grain de cuir sur tout le fond (décor) */}
        <svg aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.12] mix-blend-overlay">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 .8  0 0 0 0 .6  0 0 0 .9 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
        {children}
      </body>
    </html>
  );
}
