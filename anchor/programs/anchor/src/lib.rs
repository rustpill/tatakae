use anchor_lang::prelude::*;

mod constants;
mod errors;
mod handlers;
mod state;

use handlers::*;
use state::enums::BattleMode;

declare_id!("HpDmnSupPc6nSMiKjWn5Bcm6hVVM4bQdAhCeiCFocmfz");

#[program]
pub mod anchor {
    use crate::state::BattleMode;

    use super::*;

    pub fn mint_fighter(ctx: Context<MintFighter>) -> Result<()> {
        handlers::mint_fighter::mint_fighter(ctx)
    }

    pub fn create_battle(
        ctx: Context<CreateBattle>,
        opponent: Option<Pubkey>,
        opponent_nft: Option<Pubkey>,
        battle_mode: BattleMode,
    ) -> Result<()> {
        handlers::create_battle(ctx, opponent, opponent_nft, battle_mode)?;
        Ok(())
    }

    pub fn accept_battle(ctx: Context<AcceptBattle>) -> Result<()> {
        handlers::accept_battle(ctx)?;
        Ok(())
    }

    pub fn cancel_battle(ctx: Context<CancelBattle>) -> Result<()> {
        handlers::cancel_battle(ctx)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
