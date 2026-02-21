use crate::constants::*;
use crate::errors::FighterError;
use crate::state::{Battle, BattleStatus};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct CancelBattle<'info> {
    /// Original battle PDA creator
    #[account(mut)]
    pub signer: Signer<'info>,

    /// The NFT mint of signers fighter
    pub signer_mint: Account<'info, Mint>,

    /// Signers token account to receive the NFT back
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = signer_mint,
        associated_token::authority = signer,
    )]
    pub signer_token_account: Box<Account<'info, TokenAccount>>,

    /// Escrow holding the signers NFT
    #[account(
        mut,
        seeds = [ESCROW_SEED, battle.key().as_ref(), signer_mint.key().as_ref()],
        bump,
    )]
    pub signer_escrow: Box<Account<'info, TokenAccount>>,

    /// Battle PDA, must be Pending status and owned by signer
    #[account(
        mut,
        close = signer,
        seeds = [BATTLE_SEED, signer_mint.key().as_ref()],
        bump = battle.bump,
        constraint = battle.status == BattleStatus::Pending @ FighterError::BattleNotPending,
        constraint = battle.signer == signer.key() @ FighterError::UnauthorizedCancel,
        constraint = battle.signer_nft == signer_mint.key() @ FighterError::UnauthorizedCancel,
    )]
    pub battle: Box<Account<'info, Battle>>,

    /// Program accounts needed
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> CancelBattle<'info> {
    /// Transfer NFT back from escrow to signer
    fn return_nft_from_escrow(&self, battle_seeds: &[&[u8]]) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.signer_escrow.to_account_info(),
            to: self.signer_token_account.to_account_info(),
            authority: self.battle.to_account_info(),
        };

        let binding = [battle_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            &binding,
        );

        token::transfer(cpi_ctx, 1)
    }

    /// Close empty escrow
    fn close_escrow(&self, battle_seeds: &[&[u8]]) -> Result<()> {
        let cpi_accounts = CloseAccount {
            account: self.signer_escrow.to_account_info(),
            destination: self.signer.to_account_info(),
            authority: self.battle.to_account_info(),
        };

        let binding = [battle_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            &binding,
        );

        token::close_account(cpi_ctx)
    }
}

pub fn cancel_battle(ctx: Context<CancelBattle>) -> Result<()> {
    let signer_nft = ctx.accounts.battle.signer_nft;
    let battle_bump = ctx.accounts.battle.bump;

    let battle_seeds: &[&[u8]] = &[BATTLE_SEED, signer_nft.as_ref(), &[battle_bump]];

    // Return NFT to signer
    ctx.accounts.return_nft_from_escrow(battle_seeds)?;

    // Close account
    ctx.accounts.close_escrow(battle_seeds)?;

    // Emit event
    emit!(BattleCancelled {
        battle: ctx.accounts.battle.key(),
        signer: ctx.accounts.signer.key(),
        signer_nft,
    });

    Ok(())
}

#[event]
pub struct BattleCancelled {
    pub battle: Pubkey,
    pub signer: Pubkey,
    pub signer_nft: Pubkey,
}
