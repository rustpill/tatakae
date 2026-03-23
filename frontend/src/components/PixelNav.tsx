"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function PixelNav() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "HOME" },
    { href: "/about", label: "ABOUT" },
    { href: "/arena", label: "ARENA" },
    { href: "/profile", label: "PROFILE" },
    { href: "/faucet", label: "FAUCET" }
  ];

  return (
    <nav className="pixel-nav pl-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={`pixel-nav__link${pathname === l.href ? " pixel-nav__link--active" : ""}`}>
          {l.label}
        </Link>
      ))}
      <div className="pixel-nav__wallet">
        <WalletMultiButton />
      </div>
    </nav>
  );
}