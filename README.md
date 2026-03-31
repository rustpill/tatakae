# Tatakae

Tatakae is an on-chain NFT battle game on Solana. Users can engage in "Pink Slip" or "Bite" (power drain) battles with their NFTs.

<p align="center">
  <img src="./frontend/public/logo.png" alt="Logo" width="250" />
  <br>
  <a href="https://tatakae-frontend.vercel.app/">Website</a> | <a href="./setup.md">Setup Guide</a>
</p>

---
 
## Prerequisites

<div align="center">
  <a href="#">
      <img src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white&style=flat-square" height="20" alt="Node.js ≥20">
  </a>
  <a href="#">
      <img src="https://img.shields.io/badge/pnpm-%E2%89%A510-F69220?logo=pnpm&logoColor=white&style=flat-square" height="20" alt="pnpm ≥10">
  </a>
  <a href="#">
      <img src="https://img.shields.io/badge/Rust-stable-red?logo=rust&logoColor=white&style=flat-square" height="20" alt="Rust stable">
  </a>
  <a href="#">
      <img src="https://img.shields.io/badge/Solana_CLI-%E2%89%A53.1.7-9945FF?logo=solana&logoColor=white&style=flat-square" height="20" alt="Solana CLI ≥3.1.7">
  </a>
  <a href="#">
      <img src="https://img.shields.io/badge/Anchor_CLI-0.32.1-blue?logo=anchor&logoColor=white&style=flat-square" height="20" alt="Anchor CLI 0.32.1">
  </a>
  <a href="#">
      <img src="https://img.shields.io/badge/Wrangler-%E2%89%A54-F38020?logo=cloudflare&logoColor=white&style=flat-square" height="20" alt="Wrangler ≥4">
  </a>
</div>
<br>

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Anchor CLI
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm install 0.32.1
avm use 0.32.1

# Wrangler
pnpm add -g wrangler

# Optional - AIO command (Rust, Solana CLI, Anchor CLI)
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash

```
 
You will also need a **Cloudflare account** with R2, Workers, and D1 enabled, and a **Solana keypair** at `~/.config/solana/id.json`. This keypair is the program authority - its public key is hardcoded as `PROGRAM_AUTHORITY` in `anchor/programs/anchor/src/constants.rs` which you will need to change.
 
---

## Setup

See [`SETUP.md`](./setup.md) for full in-depth guide on how to set up the project for local or production.