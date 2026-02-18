use crate::state::enums::{BattleMode, BattleStatus};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Battle {
    pub signer: Pubkey,
    pub opponent: Option<Pubkey>, // optional until accepted

    pub signer_nft: Pubkey,
    pub opponent_nft: Option<Pubkey>,

    pub signer_power: Option<u16>,
    pub opponent_power: Option<u16>,

    pub battle_mode: BattleMode,
    pub status: BattleStatus,

    // Power level constraints for open battles
    pub min_power: Option<u16>,
    pub max_power: Option<u16>,

    pub created_at: i64,
    pub accepted_at: Option<i64>,

    pub random_seed: Option<u64>,
    pub winner: Option<Pubkey>,

    pub bump: u8,
}
