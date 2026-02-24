use anchor_lang::prelude::*;

/// Fighter - The source of truth for all fighter data
/// This is created when a fighter NFT is minted
/// Only the program can update this
#[account]
#[derive(InitSpace)]
pub struct Fighter {
    /// The owner of this fighter
    pub owner: Pubkey,
    /// The NFT mint address for this fighter
    pub mint: Pubkey,
    /// Fighter's power level (used in battle probability)
    pub power: u16,
    /// Total wins
    pub wins: u32,
    /// Total losses
    pub losses: u32,
    /// Created timestamp
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl Fighter {
    /// Record a win
    pub fn record_win(&mut self) {
        self.wins = self.wins.saturating_add(1);
    }
    /// Record a loss
    pub fn record_loss(&mut self) {
        self.losses = self.losses.saturating_add(1);
    }
}
