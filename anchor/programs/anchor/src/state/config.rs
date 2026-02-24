use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    // Merkle root for init fighter proof
    pub merkle_root: [u8; 32],
    pub bump: u8,
}
