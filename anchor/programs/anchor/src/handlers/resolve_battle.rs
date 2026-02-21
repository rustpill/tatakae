use anchor_lang::prelude::*;
use solana_program::hash::hashv;

use crate::errors::FighterError;
use crate::state::BattleMode;

/// Get random value from SlotHashes sysvar
/// This is a function called from accept_battle
pub fn get_random_u64(slot_hashes_info: &UncheckedAccount, battle_key: &Pubkey) -> Result<u64> {
    let data = slot_hashes_info
        .try_borrow_data()
        .map_err(|_| error!(FighterError::InvalidBattleMode))?;

    // SlotHashes layout: 8 bytes (u64 count) + entries of (8 byte slot + 32 byte hash)
    // We need at least 1 entry: 8 + 40 = 48 bytes
    if data.len() < 48 {
        return err!(FighterError::InvalidBattleMode);
    }

    // Skip the 8-byte length prefix, then skip 8-byte slot, read 32-byte hash
    let hash_bytes: &[u8; 32] = data[16..48]
        .try_into()
        .map_err(|_| error!(FighterError::InvalidBattleMode))?;

    let hash_result = hashv(&[hash_bytes, battle_key.as_ref()]);
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
