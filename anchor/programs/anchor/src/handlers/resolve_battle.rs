use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};
use solana_program::hash::hashv;

use crate::constants::*;
use crate::errors::FighterError;
use crate::state::{Battle, BattleMode, BattleStatus, Fighter};

#[derive(Accounts)]
pub struct ResolveBattle<'info> {
    #[account(
        mut,
        // Only program can call
        address = PROGRAM_AUTHORITY @ FighterError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    /// Battle PDA, close at end of instruction
    /// enforce slot hash delay into constraint
    #[account(
        mut,
        close = battle_signer,
        constraint = battle.status == BattleStatus::Accepted @ FighterError::BattleNotAccepted,
        constraint = {
            let accepted_slot = battle.accepted_slot
                .ok_or(FighterError::BattleNotAccepted)?;
            Clock::get()?.slot > accepted_slot + RESOLVE_DELAY_SLOTS
        } @ FighterError::BattleNotReadyToResolve,
    )]
    pub battle: Box<Account<'info, Battle>>,

    /// Required for signer_token_account
    #[account(
        mut,
        address = battle.signer,
    )]
    pub battle_signer: SystemAccount<'info>,

    /// Required for opponent_token_account
    #[account(
        mut,
        address = battle.opponent.ok_or(FighterError::BattleNotAccepted)?,
    )]
    pub battle_opponent: SystemAccount<'info>,

    /// Signers fighter escrow
    #[account(
        mut,
        seeds = [ESCROW_SEED, battle.key().as_ref(), battle.signer_nft.as_ref()],
        bump,
    )]
    pub signer_escrow: Box<Account<'info, TokenAccount>>,

    /// Opponent fighter escrow
    #[account(
        mut,
        seeds = [ESCROW_SEED, battle.key().as_ref(), battle.opponent_nft.ok_or(FighterError::BattleNotAccepted)?.as_ref()],
        bump,
    )]
    pub opponent_escrow: Box<Account<'info, TokenAccount>>,

    /// Signer NFT token account
    #[account(
        mut,
        associated_token::mint = signer_nft_mint,
        associated_token::authority = battle_signer,
    )]
    pub signer_token_account: Box<Account<'info, TokenAccount>>,

    /// Opponent NFT token account
    #[account(
        mut,
        associated_token::mint = opponent_nft_mint,
        associated_token::authority = battle_opponent,
    )]
    pub opponent_token_account: Box<Account<'info, TokenAccount>>,

    /// Signers NFT mint, Required for signer_token_account and opponents_signer_ata.
    #[account(
        address = battle.signer_nft,
    )]
    pub signer_nft_mint: Account<'info, Mint>,

    /// Opponents NFT mint, Required for opponent_token_account and signers_opponent_ata.
    #[account(
        address = battle.opponent_nft.ok_or(FighterError::BattleNotAccepted)?,
    )]
    pub opponent_nft_mint: Account<'info, Mint>,

    /// Signers ATA for the opponents NFT mint.
    /// Receives opponents NFT if signer wins and mode is PinkSlip.
    #[account(
        mut,
        associated_token::mint = opponent_nft_mint,
        associated_token::authority = battle_signer,
    )]
    pub signers_opponent_ata: Box<Account<'info, TokenAccount>>,

    /// Opponents ATA for the signers NFT mint.
    /// Receives signers NFT if signer wins and mode is PinkSlip.
    #[account(
        mut,
        associated_token::mint = signer_nft_mint,
        associated_token::authority = battle_opponent,
    )]
    pub opponents_signer_ata: Box<Account<'info, TokenAccount>>,

    /// Signers Fighter PDA
    #[account(
        mut,
        seeds = [FIGHTER_SEED, battle.signer_nft.as_ref()],
        bump,
    )]
    pub signer_fighter: Box<Account<'info, Fighter>>,

    /// Opponents Fighter PDA
    #[account(
        mut,
        seeds = [FIGHTER_SEED, battle.opponent_nft.ok_or(FighterError::BattleNotAccepted)?.as_ref()],
        bump,
    )]
    pub opponent_fighter: Box<Account<'info, Fighter>>,

    /// CHECK: SlotHashes sysvar
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,

    /// Program accounts needed
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ResolveBattle<'info> {
    /// Transfer NFT from an escrow to an ATA.
    /// Uses battle PDA as signer authority over the escrow.
    fn transfer_from_escrow(
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
        token::transfer(cpi_ctx, 1)
    }

    /// Close escrow token account and return rent to a target destination.
    fn close_escrow(
        &self,
        escrow: &Account<'info, TokenAccount>,
        destination: &AccountInfo<'info>,
        battle_seeds: &[&[u8]],
    ) -> Result<()> {
        let cpi_accounts = CloseAccount {
            account: escrow.to_account_info(),
            destination: destination.clone(),
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

pub fn resolve_battle(ctx: Context<ResolveBattle>) -> Result<()> {
    let battle_mode = ctx.accounts.battle.battle_mode;
    let battle_bump = ctx.accounts.battle.bump;
    let signer_nft = ctx.accounts.battle.signer_nft;
    let opponent_nft = ctx.accounts.battle.opponent_nft.unwrap();
    let signer_pubkey = ctx.accounts.battle.signer;
    let opponent_pubkey = ctx.accounts.battle.opponent.unwrap();

    let battle_seeds: &[&[u8]] = &[BATTLE_SEED, signer_nft.as_ref(), &[battle_bump]];

    // Power values
    let signer_power = ctx.accounts.signer_fighter.power;
    let opponent_power = ctx.accounts.opponent_fighter.power;

    // 0 Guard
    require!(signer_power > 0, FighterError::ZeroPowerFighter);
    require!(opponent_power > 0, FighterError::ZeroPowerFighter);

    // Get randomness
    // Hash is a slot >= accepted_slot + RESOLVE_DELAY_SLOTS
    let random_value = get_random_u64(&ctx.accounts.slot_hashes, &ctx.accounts.battle.key())?;

    let total_power = signer_power as u64 + opponent_power as u64;
    let signer_wins = (random_value % total_power) < signer_power as u64;

    // Resolve battle mode
    match battle_mode {
        BattleMode::PinkSlip => {
            if signer_wins {
                // Signers NFT returns to signer
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.signer_escrow,
                    &ctx.accounts.signer_token_account,
                    battle_seeds,
                )?;
                // Opponents NFT goes to signer
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.opponent_escrow,
                    &ctx.accounts.signers_opponent_ata,
                    battle_seeds,
                )?;
                ctx.accounts.battle.winner = Some(signer_pubkey);
            } else {
                // Signers NFT goes to opponent
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.signer_escrow,
                    &ctx.accounts.opponents_signer_ata,
                    battle_seeds,
                )?;
                // Opponents NFT returns to opponent
                ctx.accounts.transfer_from_escrow(
                    &ctx.accounts.opponent_escrow,
                    &ctx.accounts.opponent_token_account,
                    battle_seeds,
                )?;
                ctx.accounts.battle.winner = Some(opponent_pubkey);
            }
        }

        BattleMode::Bite => {
            // Return NFTs back to owners, apply bite penalty
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
                emit!(BattleBiteResult {
                    battle: ctx.accounts.battle.key(),
                    winner_nft: signer_nft,
                    loser_nft: opponent_nft,
                    winner_new_power: ctx.accounts.signer_fighter.power,
                    loser_new_power: ctx.accounts.opponent_fighter.power,
                });
            } else {
                // Change winner in Battle PDA
                ctx.accounts.battle.winner = Some(opponent_pubkey);
                // Bite amount
                let bite_amount = ctx.accounts.signer_fighter.power / 5;
                // Append 20% of opponents fighter power
                ctx.accounts.opponent_fighter.power = ctx
                    .accounts
                    .opponent_fighter
                    .power
                    .saturating_add(bite_amount);
                // Remove 20% of opponents fighter power
                ctx.accounts.signer_fighter.power = ctx
                    .accounts
                    .signer_fighter
                    .power
                    .saturating_sub(bite_amount);
                // Emit Battle results
                emit!(BattleBiteResult {
                    battle: ctx.accounts.battle.key(),
                    winner_nft: opponent_nft,
                    loser_nft: signer_nft,
                    winner_new_power: ctx.accounts.opponent_fighter.power,
                    loser_new_power: ctx.accounts.signer_fighter.power,
                });
            }
        }
    }

    // Update battle state
    ctx.accounts.battle.signer_power = Some(signer_power);
    ctx.accounts.battle.opponent_power = Some(opponent_power);
    ctx.accounts.battle.random_seed = Some(random_value);
    ctx.accounts.battle.status = BattleStatus::Completed;

    // Update fighter records
    if signer_wins {
        ctx.accounts.signer_fighter.record_win();
        ctx.accounts.opponent_fighter.record_loss();
    } else {
        ctx.accounts.signer_fighter.record_loss();
        ctx.accounts.opponent_fighter.record_win();
    }

    // Close escrows, rent is returned
    ctx.accounts.close_escrow(
        &ctx.accounts.signer_escrow,
        &ctx.accounts.battle_signer.to_account_info(),
        battle_seeds,
    )?;
    ctx.accounts.close_escrow(
        &ctx.accounts.opponent_escrow,
        &ctx.accounts.battle_opponent.to_account_info(),
        battle_seeds,
    )?;

    // Emit event
    emit!(BattleResolved {
        battle: ctx.accounts.battle.key(),
        winner: ctx.accounts.battle.winner.unwrap(),
        battle_mode,
        signer_fighter: signer_nft,
        opponent_fighter: opponent_nft,
        signer_power,
        opponent_power,
        random_seed: random_value,
    });

    Ok(())
}

/// Get random value from SlotHashes sysvar
pub fn get_random_u64(slot_hashes_info: &UncheckedAccount, battle_key: &Pubkey) -> Result<u64> {
    let data = slot_hashes_info
        .try_borrow_data()
        .map_err(|_| error!(FighterError::InvalidBattleMode))?;

    // slot + hash equal 48, need one full entry
    if data.len() < 48 {
        return err!(FighterError::InvalidBattleMode);
    }

    // random hash stored in 16.48
    let hash_bytes: &[u8; 32] = data[16..48]
        .try_into()
        .map_err(|_| error!(FighterError::InvalidBattleMode))?;

    let hash_result = hashv(&[hash_bytes, battle_key.as_ref()]);
    // first 8 bytes creates a u64
    let random_bytes = &hash_result.to_bytes()[0..8];
    Ok(u64::from_le_bytes(random_bytes.try_into().unwrap()))
}

/// Event emitted when a battle resolves
#[event]
pub struct BattleResolved {
    pub battle: Pubkey,
    pub winner: Pubkey,
    pub battle_mode: BattleMode,
    pub signer_fighter: Pubkey,
    pub opponent_fighter: Pubkey,
    pub signer_power: u16,
    pub opponent_power: u16,
    pub random_seed: u64,
}

/// Event emitted for Bite mode battle result
#[event]
pub struct BattleBiteResult {
    pub battle: Pubkey,
    pub winner_nft: Pubkey,
    pub loser_nft: Pubkey,
    pub winner_new_power: u16,
    pub loser_new_power: u16,
}
