use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};
use solana_program::hash::hashv;

use crate::constants::*;
use crate::errors::FighterError;
use crate::handlers::accept_battle::AcceptBattle;
use crate::state::{BattleMode, BattleStatus};

impl<'info> AcceptBattle<'info> {
    /// Transfer NFT from escrow to destination
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

/// Pure internal logic for resolving a battle
/// Call from `accept_battle` with `resolve_battle(&mut ctx.accounts)?`
pub fn resolve_battle(accounts: &mut AcceptBattle) -> Result<()> {
    let signer_power = accounts.signer_stats.power;
    let opponent_power = accounts.opponent_stats.power;

    // Random seed
    let random_value = get_random_u64(&accounts.slot_hashes, &accounts.battle.key())?;

    let total_power = signer_power as u64 + opponent_power as u64;
    let signer_wins = (random_value % total_power) < signer_power as u64;

    // Snapshot values before mutable borrow
    let battle_mode = accounts.battle.battle_mode;
    let battle_bump = accounts.battle.bump;
    let signer_nft = accounts.battle.signer_nft;
    let signer_pubkey = accounts.battle.signer;
    let opponent_pubkey = accounts.battle.opponent;
    let opponent_nft = accounts.battle.opponent_nft;

    // PDA seeds for signing transfers
    let battle_seeds = &[BATTLE_SEED, signer_nft.as_ref(), &[battle_bump]];

    // Battle mode logic
    match &battle_mode {
        BattleMode::PinkSlip => {
            if signer_wins {
                // Winner takes both NFTs
                accounts.transfer_from_escrow(
                    &accounts.signer_escrow,
                    &accounts.signer_token_account,
                    battle_seeds,
                )?;
                accounts.transfer_from_escrow(
                    &accounts.opponent_escrow,
                    &accounts.signer_token_account,
                    battle_seeds,
                )?;
                accounts.battle.winner = Some(signer_pubkey);
            } else {
                accounts.transfer_from_escrow(
                    &accounts.signer_escrow,
                    &accounts.opponent_token_account,
                    battle_seeds,
                )?;
                accounts.transfer_from_escrow(
                    &accounts.opponent_escrow,
                    &accounts.opponent_token_account,
                    battle_seeds,
                )?;
                accounts.battle.winner = opponent_pubkey;
            }
        }
        BattleMode::Bite => {
            // Return NFTs to owners, emit stat penalty event
            accounts.transfer_from_escrow(
                &accounts.signer_escrow,
                &accounts.signer_token_account,
                battle_seeds,
            )?;
            accounts.transfer_from_escrow(
                &accounts.opponent_escrow,
                &accounts.opponent_token_account,
                battle_seeds,
            )?;

            if signer_wins {
                accounts.battle.winner = Some(signer_pubkey);
                emit!(BattleBiteResult {
                    battle: accounts.battle.key(),
                    loser_nft: opponent_nft.unwrap(),
                    loser_wallet: opponent_pubkey.unwrap(),
                    loser_power: opponent_power,
                });
            } else {
                accounts.battle.winner = opponent_pubkey;
                emit!(BattleBiteResult {
                    battle: accounts.battle.key(),
                    loser_nft: signer_nft,
                    loser_wallet: signer_pubkey,
                    loser_power: signer_power,
                });
            }
        }
    }

    // Update battle state
    let battle = &mut accounts.battle;
    battle.signer_power = Some(signer_power);
    battle.opponent_power = Some(opponent_power);
    battle.random_seed = Some(random_value);
    battle.status = BattleStatus::Completed;

    // Update fighter stats
    if signer_wins {
        accounts.signer_stats.record_win();
        accounts.opponent_stats.record_loss();
        if battle_mode == BattleMode::Bite {
            accounts.opponent_stats.apply_bite_penalty();
        }
    } else {
        accounts.signer_stats.record_loss();
        accounts.opponent_stats.record_win();
        if battle_mode == BattleMode::Bite {
            accounts.signer_stats.apply_bite_penalty();
        }
    }

    // Emit final battle resolved event
    emit!(BattleResolved {
        battle: battle.key(),
        winner: battle.winner.unwrap(),
        battle_mode,
        signer_fighter: signer_nft,
        opponent_fighter: opponent_nft.unwrap(),
        signer_power,
        opponent_power,
        random_seed: random_value,
    });

    Ok(())
}

/// Randomness from SlotHashes
fn get_random_u64(slot_hashes: &UncheckedAccount, battle_key: &Pubkey) -> Result<u64> {
    let slot_hashes =
        anchor_lang::solana_program::sysvar::slot_hashes::SlotHashes::from_account_info(
            slot_hashes,
        )
        .map_err(|_| error!(FighterError::InvalidBattleMode))?;

    let most_recent = slot_hashes
        .first()
        .ok_or(error!(FighterError::InvalidBattleMode))?;

    let hash_result = hashv(&[&most_recent.1.to_bytes(), battle_key.as_ref()]);
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
    pub loser_nft: Pubkey,
    pub loser_wallet: Pubkey,
    pub loser_power: u16,
}
