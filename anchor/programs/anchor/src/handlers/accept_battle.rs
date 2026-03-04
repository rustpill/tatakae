use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::FighterError;
use crate::state::{Battle, BattleStatus, Fighter};

#[derive(Accounts)]
pub struct AcceptBattle<'info> {
    /// Opponent (signer) accepting the battle
    #[account(
        mut,
        // Cannot accept your own battle
        constraint = opponent.key() != battle.signer @ FighterError::CannotAcceptOwnBattle)]
    pub opponent: Signer<'info>,

    /// Opponent NFT mint
    #[account(
        // Check is NFT, check not same NFT as the signer NFT stored in the Battle
        constraint = opponent_mint.key() != battle.signer_nft @ FighterError::InvalidOpponentNFT,
        constraint = opponent_mint.decimals == 0 @ FighterError::InvalidNFTMint,
        constraint = opponent_mint.supply == 1 @ FighterError::InvalidNFTMint,
    )]
    pub opponent_mint: Account<'info, Mint>,

    /// Opponent NFT token account
    #[account(
        mut,
        // Check ownership of NFT matches
        associated_token::authority = opponent.key(),
        // Check the token accounts mint is the same as the NFT mint
        associated_token::mint = opponent_mint.key(),
        // Check the token accounts mint is not the same as the NFT already in the battle
        constraint = opponent_token_account.mint != battle.signer_nft @ FighterError::InvalidNFTMint,
        // Check if valid NFT count
        constraint = opponent_token_account.amount == 1 @ FighterError::InvalidNFTMint,
    )]
    pub opponent_token_account: Box<Account<'info, TokenAccount>>,

    /// Create escrow for the Opponents NFT
    #[account(
        init,
        payer = opponent,
        seeds = [ESCROW_SEED, battle.key().as_ref(), opponent_mint.key().as_ref()],
        token::mint = opponent_mint,
        // Battle has authority
        token::authority = battle,
        bump,
    )]
    pub opponent_escrow: Box<Account<'info, TokenAccount>>,

    /// Battle PDA
    #[account(
        mut,
        // Cannot accept a pending battle
        constraint = battle.status == BattleStatus::Pending @ FighterError::BattleNotPending,
    )]
    pub battle: Box<Account<'info, Battle>>,

    /// Signers Fighter PDA derived from their NFT mint
    #[account(
        mut,
        seeds = [FIGHTER_SEED, battle.signer_nft.as_ref()],
        bump,
    )]
    pub signer_fighter: Box<Account<'info, Fighter>>,

    /// Opponent Fighter PDA derived from their NFT mint
    #[account(
        mut,
        seeds = [FIGHTER_SEED, opponent_mint.key().as_ref()],
        bump,
    )]
    pub opponent_fighter: Box<Account<'info, Fighter>>,

    /// Required for signers_opponent_ata
    #[account(
        mut,
        address = battle.signer
    )]
    pub battle_signer: SystemAccount<'info>,

    /// Signers token account for opponents NFT mint (derived from signer + opponent_mint)
    /// Used if the signer wins
    #[account(
        init_if_needed,
        payer = opponent,
        associated_token::mint = opponent_mint,
        associated_token::authority = battle_signer,
    )]
    pub signers_opponent_ata: Box<Account<'info, TokenAccount>>,

    /// Signers NFT mint, Required for opponents_signer_ata
    #[account(
        address = battle.signer_nft
    )]
    pub signer_nft_mint: Account<'info, Mint>,

    /// Opponents token account for signers NFT mint (derived from opponent + signer_mint)
    /// Used if the opponent wins
    #[account(
        init_if_needed,
        payer = opponent,
        associated_token::mint = signer_nft_mint,
        associated_token::authority = opponent,
    )]
    pub opponents_signer_ata: Box<Account<'info, TokenAccount>>,

    /// Program accounts needed
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> AcceptBattle<'info> {
    /// Transfer Opponents NFT to opponent escrow
    pub fn transfer_to_opponent_escrow(&self) -> Result<()> {
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
    // Clock for timestamp
    let clock = Clock::get()?;

    // If this is a targeted battle, validate the opponent matches
    if let Some(expected_opponent) = ctx.accounts.battle.opponent {
        require!(
            expected_opponent == ctx.accounts.opponent.key(),
            FighterError::InvalidOpponent
        );
    }

    // If a specific NFT was requested, validate it matches
    if let Some(expected_nft) = ctx.accounts.battle.opponent_nft {
        require!(
            expected_nft == ctx.accounts.opponent_mint.key(),
            FighterError::InvalidOpponentNFT
        );
    }

    // Validate power level constraints if set
    if ctx.accounts.battle.min_power.is_some() || ctx.accounts.battle.max_power.is_some() {
        let opponent_power = ctx.accounts.opponent_fighter.power;

        if let Some(min) = ctx.accounts.battle.min_power {
            require!(opponent_power >= min, FighterError::InvalidPowerRange);
        }

        if let Some(max) = ctx.accounts.battle.max_power {
            require!(opponent_power <= max, FighterError::InvalidPowerRange);
        }
    }

    // Transfer opponents NFT to opponent escrow
    ctx.accounts.transfer_to_opponent_escrow()?;

    // Update battle state with opponent info
    let battle = &mut ctx.accounts.battle;
    battle.opponent = Some(ctx.accounts.opponent.key());
    battle.opponent_nft = Some(ctx.accounts.opponent_mint.key());
    battle.accepted_at = Some(clock.unix_timestamp);
    battle.accepted_slot = Some(clock.slot);
    battle.status = BattleStatus::Accepted;

    // Emit event
    emit!(BattleAccepted {
        battle: battle.key(),
        signer_nft: battle.signer_nft,
        opponent: ctx.accounts.opponent.key(),
        opponent_nft: ctx.accounts.opponent_mint.key(),
        accepted_slot: clock.slot,
    });

    Ok(())
}

#[event]
pub struct BattleAccepted {
    pub battle: Pubkey,
    pub signer_nft: Pubkey,
    pub opponent: Pubkey,
    pub opponent_nft: Pubkey,
    pub accepted_slot: u64,
}
