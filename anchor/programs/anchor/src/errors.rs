use anchor_lang::prelude::*;

#[error_code]
pub enum FighterError {
    #[msg("This fighter already has a pending battle")]
    FighterAlreadyInBattle,

    #[msg("Battle is not in pending status")]
    BattleNotPending,

    #[msg("Battle is not in accepted status")]
    BattleNotAccepted,

    #[msg("Only the battle creator can cancel")]
    UnauthorizedCancel,

    #[msg("Cannot accept your own battle")]
    CannotAcceptOwnBattle,

    #[msg("Invalid battle mode")]
    InvalidBattleMode,

    #[msg("User does not own this fighter NFT")]
    UnauthorizedFighter,

    #[msg("Battle has already been accepted")]
    BattleAlreadyAccepted,

    #[msg("Invalid NFT mint")]
    InvalidNFTMint,

    #[msg("Opponent and opponent_nft must both be specified or both be None")]
    InvalidOpponentDeclaration,

    #[msg("Invalid opponent")]
    InvalidOpponent,

    #[msg("Wrong fighter selected")]
    InvalidOpponentNFT,

    #[msg("Fighter power level out of range")]
    InvalidPowerRange,

    // for init fighters
    #[msg("Merkle proof is invalid for the provided attributes")]
    InvalidProof,

    #[msg("Unauthorized instruction")]
    Unauthorized,
}
