use crate::constants::{CONFIG_SEED, PROGRAM_AUTHORITY};
use crate::errors::FighterError;
use crate::state::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
    mut,
    // Only program can call
    address = PROGRAM_AUTHORITY @ FighterError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    /// Create config PDA storing our merkle root
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    merkle_root: [u8; 32],
    collection_mint: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(
        config.merkle_root != merkle_root || config.collection_mint != collection_mint,
        FighterError::NoChanges
    );

    config.merkle_root = merkle_root;
    config.collection_mint = collection_mint;

    emit!(ConfigUpdated {
        merkle_root,
        collection_mint,
    });

    Ok(())
}

#[event]
pub struct ConfigUpdated {
    pub merkle_root: [u8; 32],
    pub collection_mint: Pubkey,
}
