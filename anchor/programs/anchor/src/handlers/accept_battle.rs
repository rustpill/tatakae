use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::FighterError;
use crate::handlers::resolve_battle::resolve_battle;
use crate::state::{Battle, BattleStatus, Fighter};

#[derive(Accounts)]
pub struct AcceptBattle<'info> {
    /// Opponent (battle acceptor)
    #[account(mut)]
    pub opponent: Signer<'info>,

    /// The NFT mint of opponent's fighter
    #[account(
        constraint = opponent_mint.decimals == 0 @ FighterError::InvalidNFTMint,
        constraint = opponent_mint.supply == 1 @ FighterError::InvalidNFTMint,
    )]
    pub opponent_mint: Account<'info, Mint>,

    /// Signer's NFT mint (needed for resolve)
    pub signer_mint: Account<'info, Mint>,

    /// Opponent's token account holding the fighter NFT
    #[account(
        mut,
        constraint = opponent_token_account.owner == opponent.key() @ FighterError::UnauthorizedFighter,
        constraint = opponent_token_account.mint == opponent_mint.key(),
        constraint = opponent_token_account.amount == 1 @ FighterError::InvalidNFTMint,
    )]
    pub opponent_token_account: Account<'info, TokenAccount>,

    /// Signer's token account (needed for resolve to return NFT)
    #[account(mut)]
    pub signer_token_account: Account<'info, TokenAccount>,

    /// Escrow token account to hold opponent's fighter NFT
    #[account(
        init,
        payer = opponent,
        seeds = [ESCROW_SEED, battle.key().as_ref(), opponent_mint.key().as_ref()],
        bump,
        token::mint = opponent_mint,
        token::authority = battle,
    )]
    pub opponent_escrow: Account<'info, TokenAccount>,

    /// Signer's escrow (needed for resolve)
    #[account(
        mut,
        seeds = [ESCROW_SEED, battle.key().as_ref(), battle.signer_nft.as_ref()],
        bump,
    )]
    pub signer_escrow: Account<'info, TokenAccount>,

    /// Battle PDA (must be in Pending status)
    #[account(
        mut,
        constraint = battle.status == BattleStatus::Pending @ FighterError::BattleNotPending,
    )]
    pub battle: Account<'info, Battle>,

    /// Signer's fighter stats
    #[account(
        mut,
        seeds = [FIGHTER_SEED, battle.signer_nft.as_ref()],
        bump,
    )]
    pub signer_stats: Account<'info, Fighter>,

    /// Opponent's fighter stats
    #[account(
        mut,
        seeds = [FIGHTER_SEED, opponent_mint.key().as_ref()],
        bump,
    )]
    pub opponent_stats: Account<'info, Fighter>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Token program
    pub token_program: Program<'info, Token>,

    /// SlotHashes sysvar for randomness in resolve
    /// CHECK: This is the SlotHashes sysvar
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

impl<'info> AcceptBattle<'info> {
    /// Transfer fighter NFT from opponent to escrow
    pub fn transfer_to_escrow(&self) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.opponent_token_account.to_account_info(),
            to: self.opponent_escrow.to_account_info(),
            authority: self.opponent.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        token::transfer(cpi_ctx, 1)?;

        Ok(())
    }
}

pub fn accept_battle(ctx: Context<AcceptBattle>) -> Result<()> {
    let battle = &mut ctx.accounts.battle;
    let clock = Clock::get()?;

    // Cannot accept your own battle
    require!(
        battle.signer != ctx.accounts.opponent.key(),
        FighterError::CannotAcceptOwnBattle
    );

    // If this is a targeted battle, validate the opponent matches
    if let Some(expected_opponent) = battle.opponent {
        require!(
            expected_opponent == ctx.accounts.opponent.key(),
            FighterError::InvalidOpponent
        );
    }

    // If a specific NFT was requested, validate it matches
    if let Some(expected_nft) = battle.opponent_nft {
        require!(
            expected_nft == ctx.accounts.opponent_mint.key(),
            FighterError::InvalidOpponentNFT
        );
    }

    // Validate power level constraints if set
    if battle.min_power.is_some() || battle.max_power.is_some() {
        let opponent_power = ctx.accounts.opponent_stats.power;

        if let Some(min) = battle.min_power {
            require!(opponent_power >= min, FighterError::InvalidPowerRange);
        }

        if let Some(max) = battle.max_power {
            require!(opponent_power <= max, FighterError::InvalidPowerRange);
        }
    }

    // Update battle state with opponent info (if it was an open battle)
    battle.opponent = Some(ctx.accounts.opponent.key());
    battle.opponent_nft = Some(ctx.accounts.opponent_mint.key());
    battle.status = BattleStatus::Accepted;
    battle.accepted_at = Some(clock.unix_timestamp);

    // Transfer opponent's NFT to escrow
    ctx.accounts.transfer_to_escrow()?;

    emit!(BattleAccepted {
        battle: ctx.accounts.battle.key(),
        opponent: ctx.accounts.opponent.key(),
        opponent_nft: ctx.accounts.opponent_mint.key()
    });

    // Immediately resolve the battle via internal call
    // Note: We're not doing CPI here, but calling the resolve function directly
    // since we're in the same program. This is more efficient than CPI.
    resolve_battle(ctx.accounts)?;

    Ok(())
}

#[event]
pub struct BattleAccepted {
    pub battle: Pubkey,
    pub opponent: Pubkey,
    pub opponent_nft: Pubkey,
}
