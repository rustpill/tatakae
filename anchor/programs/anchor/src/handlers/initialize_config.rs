use crate::constants::{CONFIG_SEED, DISCRIMINATOR, PROGRAM_AUTHORITY};
use crate::errors::FighterError;
use crate::state::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
    mut,
    // Only program can call
    constraint = authority.key() == PROGRAM_AUTHORITY @ FighterError::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// Create config PDA storing our merkle root
    #[account(
        init,
        payer = authority,
        space = DISCRIMINATOR + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    /// Program accounts needed
    pub system_program: Program<'info, System>,
}

pub fn initialize_config(
    ctx: Context<InitializeConfig>,
    merkle_root: [u8; 32],
    collection_mint: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.merkle_root = merkle_root;
    config.collection_mint = collection_mint;
    config.bump = ctx.bumps.config;
    Ok(())
}
