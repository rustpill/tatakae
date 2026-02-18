use anchor_lang::prelude::*;

mod constants;
mod errors;
mod handlers;
mod state;

use handlers::*;

declare_id!("HpDmnSupPc6nSMiKjWn5Bcm6hVVM4bQdAhCeiCFocmfz");

#[program]
pub mod anchor {
    use super::*;

    pub fn mint_fighter(ctx: Context<MintFighter>, name: String, power: u16) -> Result<()> {
        handlers::mint_fighter::mint_fighter(ctx, name, power)
    }

    pub fn create_battle(ctx: Context<CreateBattle>) -> Result<()> {
        handlers::create_battle(ctx, None, None, state::BattleMode::PinkSlip)?;
        Ok(())
    }

    pub fn accept_battle(ctx: Context<AcceptBattle>) -> Result<()> {
        handlers::accept_battle(ctx)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
