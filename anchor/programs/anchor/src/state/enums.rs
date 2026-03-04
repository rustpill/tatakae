use anchor_lang::prelude::*;
use anchor_lang::Space;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BattleStatus {
    Pending,
    Accepted,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug, Copy)]
pub enum BattleMode {
    PinkSlip, // winner takes NFT
    Bite,     // stat penalty only
}

impl Space for BattleStatus {
    const INIT_SPACE: usize = 1;
}

impl Space for BattleMode {
    const INIT_SPACE: usize = 1;
}
