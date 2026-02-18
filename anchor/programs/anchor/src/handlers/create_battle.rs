use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::FighterError;
use crate::state::{Battle, BattleMode, BattleStatus};

#[derive(Accounts)]
pub struct CreateBattle<'info> {
    /// Signer (battle initiator)
    #[account(mut)]
    pub signer: Signer<'info>,

    /// The NFT mint of Signer fighter
    #[account(
        constraint = signer_mint.decimals == 0 @ FighterError::InvalidNFTMint,
        constraint = signer_mint.supply == 1 @ FighterError::InvalidNFTMint,
    )]
    pub signer_mint: Account<'info, Mint>,

    /// Signer token account holding the fighter NFT
    #[account(
        mut,
        constraint = signer_token_account.owner == signer.key() @ FighterError::UnauthorizedFighter,
        constraint = signer_token_account.mint == signer_mint.key(),
        constraint = signer_token_account.amount == 1 @ FighterError::InvalidNFTMint,
    )]
    pub signer_token_account: Account<'info, TokenAccount>,

    /// Escrow token account to hold Signer's fighter NFT
    #[account(
        init,
        payer = signer,
        seeds = [ESCROW_SEED, battle.key().as_ref(), signer_mint.key().as_ref()],
        bump,
        token::mint = signer_mint,
        token::authority = battle,
    )]
    pub signer_escrow: Account<'info, TokenAccount>,

    /// Battle PDA
    #[account(
        init,
        payer = signer,
        space = DISCRIMINATOR + Battle::INIT_SPACE,
        seeds = [BATTLE_SEED, signer_mint.key().as_ref()],
        bump
    )]
    pub battle: Account<'info, Battle>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

impl<'info> CreateBattle<'info> {
    /// Transfer fighter NFT from user to escrow
    pub fn transfer_to_escrow(&self) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.signer_token_account.to_account_info(),
            to: self.signer_escrow.to_account_info(),
            authority: self.signer.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        token::transfer(cpi_ctx, 1)?;

        Ok(())
    }
}

pub fn create_battle(
    ctx: Context<CreateBattle>,
    opponent: Option<Pubkey>,
    opponent_nft: Option<Pubkey>,
    battle_mode: BattleMode,
) -> Result<()> {
    let battle = &mut ctx.accounts.battle;
    let clock = Clock::get()?;

    // Either both Some or both None
    require!(
        opponent.is_some() == opponent_nft.is_some(),
        FighterError::InvalidOpponentDeclaration
    );

    // Cannot challenge yourself
    if let Some(opponent_pubkey) = opponent {
        require!(
            opponent_pubkey != ctx.accounts.signer.key(),
            FighterError::InvalidOpponent
        );
    }

    // Initialize battle state
    battle.signer = ctx.accounts.signer.key();
    battle.opponent = opponent;
    battle.signer_nft = ctx.accounts.signer_mint.key();
    battle.opponent_nft = opponent_nft;
    battle.signer_power = None;
    battle.opponent_power = None;
    battle.battle_mode = battle_mode;
    battle.status = BattleStatus::Pending;
    battle.min_power = None;
    battle.max_power = None;
    battle.created_at = clock.unix_timestamp;
    battle.accepted_at = None;
    battle.random_seed = None;
    battle.winner = None;
    battle.bump = ctx.bumps.battle;

    // Transfer fighter NFT to escrow
    ctx.accounts.transfer_to_escrow()?;

    emit!(BattleCreated {
        battle: ctx.accounts.battle.key(),
        signer: ctx.accounts.battle.signer,
        signer_nft: ctx.accounts.battle.signer_nft,
        opponent: ctx.accounts.battle.opponent,
        opponent_nft: ctx.accounts.battle.opponent_nft,
        battle_mode: ctx.accounts.battle.battle_mode
    });

    Ok(())
}

#[event]
pub struct BattleCreated {
    pub battle: Pubkey,
    pub signer: Pubkey,
    pub signer_nft: Pubkey,
    pub opponent: Option<Pubkey>,
    pub opponent_nft: Option<Pubkey>,
    pub battle_mode: BattleMode,
}
