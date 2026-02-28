use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::FighterError;
use crate::state::{Battle, BattleStatus, Fighter};

#[derive(Accounts)]
pub struct AcceptBattle<'info> {
    /// Opponent (signer) accepting the battle
    #[account(mut)]
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

    /// Signers NFT token account, load from the battle passed in
    #[account(
        mut,
        associated_token::mint = battle.signer_nft,
        associated_token::authority = battle.signer,
    )]
    pub signer_token_account: Box<Account<'info, TokenAccount>>,

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

    /// Signers escrow holding their NFT
    #[account(
        mut,
        seeds = [ESCROW_SEED, battle.key().as_ref(), battle.signer_nft.as_ref()],
        bump,
    )]
    pub signer_escrow: Box<Account<'info, TokenAccount>>,

    /// Battle PDA
    #[account(
        mut,
        // Close battle pda at the end
        close = battle_signer,
        // Cannot accept your own battle, or a pending battle
        constraint = battle.status == BattleStatus::Pending @ FighterError::BattleNotPending,
        constraint = battle.signer != opponent.key() @ FighterError::CannotAcceptOwnBattle,
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

    /// CHECK: Required for signers_opponent_ata and for closing account
    #[account(
        mut,
        address = battle.signer
    )]
    pub battle_signer: AccountInfo<'info>,

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

    /// CHECK: SlotHashes sysvar
    /// Used for randominity
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

impl<'info> AcceptBattle<'info> {
    /// Transfer Opponents NFT to opponent escrow
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

    /// Transfer NFT from an escrow to destination
    pub fn transfer_from_escrow(
        &self,
        escrow: &Account<'info, TokenAccount>,
        destination: &Account<'info, TokenAccount>,
        battle_seeds: &[&[u8]],
    ) -> Result<()> {
        let cpi_accounts = Transfer {
            from: escrow.to_account_info(),
            to: destination.to_account_info(),
            authority: self.battle.to_account_info(),
        };

        let binding = [battle_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            &binding,
        );

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

    // Update battle state with opponent info
    ctx.accounts.battle.opponent = Some(ctx.accounts.opponent.key());
    ctx.accounts.battle.opponent_nft = Some(ctx.accounts.opponent_mint.key());
    ctx.accounts.battle.accepted_at = Some(clock.unix_timestamp);

    // Transfer opponents NFT to opponent escrow
    ctx.accounts.transfer_to_escrow()?;

    // RESOLVE BATTLE LOGIC

    // Get power stats
    let signer_power = ctx.accounts.signer_fighter.power;
    let opponent_power = ctx.accounts.opponent_fighter.power;

    // Get randomness
    let random_value = crate::handlers::resolve_battle::get_random_u64(
        &ctx.accounts.slot_hashes,
        &ctx.accounts.battle.key(),
    )?;

    // Resolve logic
    let total_power = signer_power as u64 + opponent_power as u64;
    let signer_wins = (random_value % total_power) < signer_power as u64;

    // Snapshot values
    let battle_mode = ctx.accounts.battle.battle_mode;
    let battle_bump = ctx.accounts.battle.bump;
    let signer_nft = ctx.accounts.battle.signer_nft;
    let opponent_nft = ctx.accounts.battle.opponent_nft;
    let signer_pubkey = ctx.accounts.battle.signer;
    let opponent_pubkey = ctx.accounts.battle.opponent.unwrap();
    let battle_seeds = &[BATTLE_SEED, signer_nft.as_ref(), &[battle_bump]];

    // Resolve battle mode
    match &battle_mode {
        // Transfer NFT to winning accounts
        crate::state::BattleMode::PinkSlip => {
            if signer_wins {
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.signer_escrow,
                    &ctx.accounts.signer_token_account,
                    battle_seeds,
                )?;
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.opponent_escrow,
                    &ctx.accounts.signers_opponent_ata,
                    battle_seeds,
                )?;
                ctx.accounts.battle.winner = Some(signer_pubkey);
            } else {
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.signer_escrow,
                    &ctx.accounts.opponents_signer_ata,
                    battle_seeds,
                )?;
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.opponent_escrow,
                    &ctx.accounts.opponent_token_account,
                    battle_seeds,
                )?;
                ctx.accounts.battle.winner = Some(opponent_pubkey);
            }
        }
        // Return NFTs back to owners, apply bite penalty
        crate::state::BattleMode::Bite => {
            if signer_wins {
                // Change winner in Battle PDA
                ctx.accounts.battle.winner = Some(signer_pubkey);
                // Bite amount
                let bite_amount = ctx.accounts.opponent_fighter.power / 5;
                // Append 20% of opponents fighter power
                ctx.accounts.signer_fighter.power = ctx
                    .accounts
                    .signer_fighter
                    .power
                    .saturating_add(bite_amount);
                // Remove 20% of opponents fighter power
                ctx.accounts.opponent_fighter.power = ctx
                    .accounts
                    .opponent_fighter
                    .power
                    .saturating_sub(bite_amount);
                // Emit Battle results
                emit!(crate::handlers::resolve_battle::BattleBiteResult {
                    battle: ctx.accounts.battle.key(),
                    loser_nft: opponent_nft.unwrap(),
                    winner_nft: signer_nft,
                    winner_new_power: ctx.accounts.signer_fighter.power,
                    loser_new_power: ctx.accounts.opponent_fighter.power
                });
            } else {
                // Change winner in Battle PDA
                ctx.accounts.battle.winner = Some(opponent_pubkey);
                // Bite amount
                let bite_amount = ctx.accounts.signer_fighter.power / 5;
                // Append 20% of signers fighter power
                ctx.accounts.opponent_fighter.power = ctx
                    .accounts
                    .opponent_fighter
                    .power
                    .saturating_add(bite_amount);
                // Remove 20% of signers fighter power
                ctx.accounts.signer_fighter.power = ctx
                    .accounts
                    .signer_fighter
                    .power.saturating_sub(bite_amount);
                // Emit Battle results
                emit!(crate::handlers::resolve_battle::BattleBiteResult {
                    battle: ctx.accounts.battle.key(),
                    loser_nft: signer_nft,
                    winner_nft: opponent_nft.unwrap(),
                    winner_new_power: ctx.accounts.opponent_fighter.power,
                    loser_new_power: ctx.accounts.signer_fighter.power
                });
            }

            ctx.accounts.transfer_from_escrow(
                &ctx.accounts.signer_escrow,
                &ctx.accounts.signer_token_account,
                battle_seeds,
            )?;
            ctx.accounts.transfer_from_escrow(
                &ctx.accounts.opponent_escrow,
                &ctx.accounts.opponent_token_account,
                battle_seeds,
            )?;
        }
    }

    // Update battle state
    ctx.accounts.battle.signer_power = Some(signer_power);
    ctx.accounts.battle.opponent_power = Some(opponent_power);
    ctx.accounts.battle.random_seed = Some(random_value);
    ctx.accounts.battle.status = crate::state::BattleStatus::Completed;

    // Update fighter stats
    if signer_wins {
        ctx.accounts.signer_fighter.record_win();
        ctx.accounts.opponent_fighter.record_loss();
    } else {
        ctx.accounts.signer_fighter.record_loss();
        ctx.accounts.opponent_fighter.record_win();
    }

    // Emit event
    emit!(crate::handlers::resolve_battle::BattleResolved {
        battle: ctx.accounts.battle.key(),
        winner: ctx.accounts.battle.winner.unwrap(),
        battle_mode,
        signer_fighter: signer_nft,
        opponent_fighter: opponent_nft.unwrap(),
        signer_power,
        opponent_power,
        random_seed: random_value,
    });

    Ok(())
}
