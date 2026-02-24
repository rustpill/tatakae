use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use mpl_token_metadata::accounts::Metadata;
use sha3::{Digest, Keccak256};

use crate::constants::{COLLECTION_MINT, CONFIG_SEED, DISCRIMINATOR, FIGHTER_SEED};
use crate::errors::FighterError;
use crate::state::{Config, Fighter};

#[derive(Accounts)]
pub struct InitializeFighter<'info> {
    /// Signer
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Config PDA for merkle root
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    /// Fighter PDA
    #[account(
        init,
        payer = owner,
        space = DISCRIMINATOR + Fighter::INIT_SPACE,
        seeds = [FIGHTER_SEED, fighter_mint.key().as_ref()],
        bump
    )]
    pub fighter: Box<Account<'info, Fighter>>,

    /// NFT mint
    #[account(
        constraint = fighter_mint.decimals == 0 @ FighterError::InvalidNFTMint,
        constraint = fighter_mint.supply == 1 @ FighterError::InvalidNFTMint,
    )]
    pub fighter_mint: Account<'info, Mint>,

    /// CHECK:
    /// Get metadata to check collection id
    #[account(
        seeds = [
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            fighter_mint.key().as_ref(),
        ],
        seeds::program = mpl_token_metadata::ID,
        bump,
    )]
    pub fighter_metadata: AccountInfo<'info>,

    /// NFT token account
    #[account(
        associated_token::mint = fighter_mint,
        associated_token::authority = owner,
        constraint = owner_token_account.amount == 1 @ FighterError::UnauthorizedFighter,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    /// Program accounts needed
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn initialize_fighter(
    ctx: Context<InitializeFighter>,
    // Merkle will validate
    power: u16,
    // Merkle proof
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    // Deserialize metadata and verify mint collection
    let metadata = Metadata::safe_deserialize(&ctx.accounts.fighter_metadata.data.borrow())
        .map_err(|_| FighterError::InvalidNFTMint)?;
    let collection = metadata
        .collection
        .as_ref()
        .ok_or(FighterError::InvalidNFTMint)?;
    require!(
        collection.verified && collection.key == COLLECTION_MINT,
        FighterError::InvalidNFTMint
    );

    let mint = ctx.accounts.fighter_mint.key();
    let root = ctx.accounts.config.merkle_root;

    // Compute leaf using NFTs mint from context + power
    let leaf = compute_leaf(&mint, power);

    // Walk the proof and recompute root
    let computed_root = compute_root(leaf, &proof);

    // Verify root is same or fail
    require!(computed_root == root, FighterError::InvalidProof);

    // Write to PDA
    let fighter = &mut ctx.accounts.fighter;
    let clock = Clock::get()?;

    fighter.owner = ctx.accounts.owner.key();
    fighter.mint = mint;
    fighter.power = power;
    fighter.wins = 0;
    fighter.losses = 0;
    fighter.created_at = clock.unix_timestamp;
    fighter.bump = ctx.bumps.fighter;

    emit!(FighterInitialized {
        mint,
        owner: ctx.accounts.owner.key(),
        power,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Merkle leaf builder
fn compute_leaf(mint: &Pubkey, power: u16) -> [u8; 32] {
    let mut data = Vec::with_capacity(34);
    data.extend_from_slice(mint.as_ref()); // 32 bytes
    data.extend_from_slice(&power.to_le_bytes()); // 2 bytes, little-endian

    let mut hasher = Keccak256::new();
    hasher.update(&data);
    hasher.finalize().into()
}

/// Merkle leaf walker, merkle must be ordered on backend
fn compute_root(leaf: [u8; 32], proof: &[[u8; 32]]) -> [u8; 32] {
    let mut current = leaf;

    for sibling in proof {
        let mut hasher = Keccak256::new();
        if current <= *sibling {
            hasher.update(current);
            hasher.update(sibling);
        } else {
            hasher.update(sibling);
            hasher.update(current);
        }
        current = hasher.finalize().into();
    }
    // Return calc root
    current
}

#[event]
pub struct FighterInitialized {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub power: u16,
    pub timestamp: i64,
}
