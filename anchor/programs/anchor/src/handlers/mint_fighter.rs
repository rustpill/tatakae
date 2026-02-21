use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::constants::{DISCRIMINATOR, FIGHTER_SEED};
use crate::state::Fighter;

#[derive(Accounts)]
pub struct MintFighter<'info> {
    /// The user minting the fighter
    #[account(mut)]
    pub user: Signer<'info>,

    /// The fighter NFT mint (created by user before calling this)
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = fighter_mint,
        mint::freeze_authority = fighter_mint,
    )]
    pub fighter_mint: Account<'info, Mint>,

    /// Users token account to receive the NFT
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = fighter_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    /// Fighter PDA
    #[account(
        init,
        payer = user,
        space = DISCRIMINATOR + Fighter::INIT_SPACE,
        seeds = [FIGHTER_SEED, fighter_mint.key().as_ref()],
        bump
    )]
    pub fighter: Box<Account<'info, Fighter>>,

    /// Program accounts needed
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    /// CHECK: SlotHashes sysvar
    /// Used for randominity
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

pub fn mint_fighter(ctx: Context<MintFighter>) -> Result<()> {
    let fighter = &mut ctx.accounts.fighter;
    let clock = Clock::get()?;

    // Gen random power 0-100 using slothashes
    let random_value = crate::handlers::resolve_battle::get_random_u64(
        &ctx.accounts.slot_hashes,
        &ctx.accounts.fighter_mint.key(),
    )?;
    let power = ((random_value % 100) + 1) as u16; // 1-100

    // Initialize Fighter state
    fighter.owner = ctx.accounts.user.key();
    fighter.mint = ctx.accounts.fighter_mint.key();
    fighter.power = power;
    fighter.wins = 0;
    fighter.losses = 0;
    fighter.bite_penalties = 0;
    fighter.created_at = clock.unix_timestamp;
    fighter.bump = ctx.bumps.fighter;

    // Mint the NFT to user
    let cpi_accounts = MintTo {
        mint: ctx.accounts.fighter_mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.fighter_mint.to_account_info(),
    };

    let binding = ctx.accounts.fighter_mint.key();
    let seeds = &[FIGHTER_SEED, binding.as_ref(), &[ctx.bumps.fighter]];
    let signer_seeds = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    mint_to(cpi_ctx, 1)?;

    // Emit event for backend to update off-chain metadata
    emit!(FighterMinted {
        mint: ctx.accounts.fighter_mint.key(),
        owner: ctx.accounts.user.key(),
        power,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Event emitted when a fighter is minted
/// Backend listens to this and updates off-chain metadata
#[event]
pub struct FighterMinted {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub power: u16,
    pub timestamp: i64,
}
