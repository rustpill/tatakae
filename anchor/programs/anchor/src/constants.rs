use anchor_lang::prelude::*;

/// Standard discriminator
pub const DISCRIMINATOR: usize = 8;

/// Seed for battle PDA
/// Battle PDA: [BATTLE_SEED, fighter_a_mint.key().as_ref()]
#[constant]
pub const BATTLE_SEED: &[u8] = b"battle";

/// Seed for fighter escrow token account
/// Escrow PDA: [ESCROW_SEED, battle.key().as_ref(), fighter_mint.key().as_ref()]
#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";

/// Seed for fighter pda
/// Escrow PDA: [FIGHTER_SEED, fighter_mint.key().as_ref()]
#[constant]
pub const FIGHTER_SEED: &[u8] = b"fighter";

/// Seed for config
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

/// Used in initialize_config
pub const PROGRAM_AUTHORITY: Pubkey = pubkey!("2QZvzZ4XszjtBiPKMy7wb3YZ4EwbRTovbDki99c4Cr87");

/// Collection ID used in initialize_fighter
/// todo()!
pub const COLLECTION_MINT: Pubkey = pubkey!("HpDmnSupPc6nSMiKjWn5Bcm6hVVM4bQdAhCeiCFocmfz");
