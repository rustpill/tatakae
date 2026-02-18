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
    /// Number of bite penalties accumulated
    pub bite_penalties: u8,
    /// Fighter name (stored on-chain)
    #[max_len(32)]
    pub name: String,
    /// Created timestamp
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl Fighter {
    /// Calculate win rate percentage
    pub fn win_rate(&self) -> u8 {
        let total = self.wins + self.losses;
        if total == 0 {
            return 0;
        }
        ((self.wins as f64 / total as f64) * 100.0) as u8
    }
    /// Update power level (only via program)
    pub fn set_power(&mut self, new_power: u16) {
        self.power = new_power;
    }
    /// Record a win
    pub fn record_win(&mut self) {
        self.wins = self.wins.saturating_add(1);
    }
    /// Record a loss
    pub fn record_loss(&mut self) {
        self.losses = self.losses.saturating_add(1);
    }
    /// Apply bite penalty (reduces power)
    pub fn apply_bite_penalty(&mut self) {
        self.bite_penalties = self.bite_penalties.saturating_add(1);
        // Reduce power by 1 for each bite penalty (minimum 1)
        self.power = self.power.saturating_sub(1).max(1);
    }
    /// Transfer ownership
    pub fn transfer_ownership(&mut self, new_owner: Pubkey) {
        self.owner = new_owner;
    }
}
