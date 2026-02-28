use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    // Merkle root for init fighter proof
    pub merkle_root: [u8; 32],
    pub collection_mint: Pubkey,
    pub bump: u8,
}
