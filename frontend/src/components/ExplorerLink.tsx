"use client";

interface ExplorerLinkProps {
  address: string;
  type: "address" | "tx";
  display?: string;
  className?: string;
}

const CLUSTER = process.env.NEXT_PUBLIC_RPC_URL?.includes("http://localhost:8899")
  ? "?cluster=custom&customUrl=http://localhost:8899"
  : process.env.NEXT_PUBLIC_RPC_URL?.includes("devnet")
  ? "?cluster=devnet"
  : "";

export function ExplorerLink({ address, type, display, className = "" }: ExplorerLinkProps) {

  const href = `https://explorer.solana.com/${type}/${address}${CLUSTER}`;
  const label = display ?? `${address.slice(0, 6)}...${address.slice(-6)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className={`font-vt text-[17px] text-steel-2 no-underline border-b border-steel-4 transition-colors duration-100 cursor-pointer hover:text-gold hover:border-gold ${className}`}
    >
      {label}
    </a>
  );
}