use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
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
        // Check ownership of NFT matches
        associated_token::authority = signer,
        // Check the token accounts mint is the same as the NFT mint
        associated_token::mint = signer_mint,
        // Check if valid NFT count
        constraint = signer_token_account.amount == 1 @ FighterError::InvalidNFTMint,
    )]
    pub signer_token_account: Box<Account<'info, TokenAccount>>,

    /// Create escrow for the Signer NFT
    #[account(
        init,
        payer = signer,
        seeds = [ESCROW_SEED, battle.key().as_ref(), signer_mint.key().as_ref()],
        bump,
        token::mint = signer_mint,
        token::authority = battle,
    )]
    pub signer_escrow: Box<Account<'info, TokenAccount>>,

    /// Create Battle PDA
    #[account(
        init,
        payer = signer,
        space = DISCRIMINATOR + Battle::INIT_SPACE,
        seeds = [BATTLE_SEED, signer_mint.key().as_ref()],
        bump
    )]
    pub battle: Box<Account<'info, Battle>>,

    /// Program accounts needed
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> CreateBattle<'info> {
    /// Transfer fighter NFT from signer to escrow
    pub fn transfer_to_signer_escrow(&self) -> Result<()> {
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
    min_power: Option<u16>,
    max_power: Option<u16>,
) -> Result<()> {
    // Clock for timestamp
    let clock = Clock::get()?;

    // Battle PDA
    let battle = &mut ctx.accounts.battle;

    // Either both Some or both None
    require!(
        opponent.is_some() == opponent_nft.is_some(),
        FighterError::InvalidOpponentDeclaration
    );

    // Nullify power constraints if opponent nft specified
    let (min_power, max_power) = if opponent_nft.is_some() {
        (None, None)
    } else {
        (min_power, max_power)
    };

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
    battle.min_power = min_power;
    battle.max_power = max_power;
    battle.created_at = clock.unix_timestamp;
    battle.accepted_at = None;
    battle.accepted_slot = None;
    battle.random_seed = None;
    battle.winner = None;
    battle.bump = ctx.bumps.battle;

    // Transfer fighter NFT to escrow
    ctx.accounts.transfer_to_signer_escrow()?;

    // Emit event
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
