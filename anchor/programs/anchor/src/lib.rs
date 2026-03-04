use anchor_lang::prelude::*;

mod constants;
mod errors;
mod handlers;
mod state;

use handlers::*;
use state::enums::BattleMode;

declare_id!("7RyLCWzdDQkMCmGpFKp5tXmTdXL8BhYKUMmA4nq88uRF");

#[program]
pub mod anchor {

    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        merkle_root: [u8; 32],
        collection_mint: Pubkey,
    ) -> Result<()> {
        handlers::initialize_config::initialize_config(ctx, merkle_root, collection_mint)
    }

    pub fn initialize_fighter(
        ctx: Context<InitializeFighter>,
        power: u16,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        handlers::initialize_fighter::initialize_fighter(ctx, power, proof)
    }

    pub fn create_battle(
        ctx: Context<CreateBattle>,
        opponent: Option<Pubkey>,
        opponent_nft: Option<Pubkey>,
        battle_mode: BattleMode,
        min_power: Option<u16>,
        max_power: Option<u16>,
    ) -> Result<()> {
        handlers::create_battle(
            ctx,
            opponent,
            opponent_nft,
            battle_mode,
            min_power,
            max_power,
        )?;
        Ok(())
    }

    pub fn accept_battle(ctx: Context<AcceptBattle>) -> Result<()> {
        handlers::accept_battle(ctx)?;
        Ok(())
    }

    pub fn resolve_battle(ctx: Context<ResolveBattle>) -> Result<()> {
        handlers::resolve_battle(ctx)?;
        Ok(())
    }

    pub fn cancel_battle(ctx: Context<CancelBattle>) -> Result<()> {
        handlers::cancel_battle(ctx)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
