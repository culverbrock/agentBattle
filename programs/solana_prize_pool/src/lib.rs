use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs");

#[program]
pub mod solana_prize_pool {
    use super::*;

    pub fn set_winners(
        ctx: Context<SetWinners>,
        game_id: [u8; 32],
        winners: Vec<Pubkey>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        require!(winners.len() == amounts.len(), PrizePoolError::InvalidInput);
        let game = &mut ctx.accounts.game;
        require!(!game.winners_set, PrizePoolError::WinnersAlreadySet);
        game.game_id = game_id;
        game.winners = winners;
        game.amounts = amounts;
        game.claimed = vec![false; winners.len()];
        game.winners_set = true;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>, game_id: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.winners_set, PrizePoolError::WinnersNotSet);
        require!(game.game_id == game_id, PrizePoolError::InvalidGameId);
        
        // Find winner index
        let winner_index = game.winners.iter().position(|&w| w == ctx.accounts.winner.key())
            .ok_or(PrizePoolError::NotAWinner)?;
        
        require!(!game.claimed[winner_index], PrizePoolError::AlreadyClaimed);
        
        // Transfer tokens using PDA signing
        let cpi_accounts = Transfer {
            from: ctx.accounts.prize_pool_token_account.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.prize_pool_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        
        // Create PDA seeds for signing
        let seeds = &[b"pool".as_ref()];
        let bump = ctx.bumps.prize_pool_authority;
        let signer_seeds = &[&seeds[..], &[bump]];
        
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &[signer_seeds]);
        
        token::transfer(cpi_ctx, game.amounts[winner_index])?;
        
        // Mark as claimed
        game.claimed[winner_index] = true;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetWinners<'info> {
    #[account(init_if_needed, payer = authority, space = 8 + 32 + 4 + 32*10 + 4 + 8*10 + 4 + 10)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub winner: Signer<'info>,
    #[account(mut)]
    pub prize_pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is the prize pool authority PDA derived from seeds
    #[account(seeds = [b"pool"], bump)]
    pub prize_pool_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Game {
    pub game_id: [u8; 32],
    pub winners: Vec<Pubkey>,
    pub amounts: Vec<u64>,
    pub claimed: Vec<bool>,
    pub winners_set: bool,
}

#[error_code]
pub enum PrizePoolError {
    #[msg("Invalid input parameters")]
    InvalidInput,
    #[msg("Winners already set for this game")]
    WinnersAlreadySet,
    #[msg("Winners not set for this game")]
    WinnersNotSet,
    #[msg("Invalid game ID")]
    InvalidGameId,
    #[msg("Not a winner")]
    NotAWinner,
    #[msg("Prize already claimed")]
    AlreadyClaimed,
} 