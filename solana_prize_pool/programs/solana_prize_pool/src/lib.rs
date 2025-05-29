use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("REPLACE_WITH_YOUR_PROGRAM_ID");

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
        let claimer = ctx.accounts.claimer.key();
        let mut found = false;
        for (i, winner) in game.winners.iter().enumerate() {
            if *winner == claimer {
                require!(!game.claimed[i], PrizePoolError::AlreadyClaimed);
                game.claimed[i] = true;
                let cpi_accounts = Transfer {
                    from: ctx.accounts.pool_token_account.to_account_info(),
                    to: ctx.accounts.claimer_token_account.to_account_info(),
                    authority: ctx.accounts.pool_authority.clone(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let seeds = &[b"pool", &game_id[..], &[ctx.bumps["pool_authority"]]];
                let signer = &[&seeds[..]];
                token::transfer(
                    CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
                    game.amounts[i],
                )?;
                found = true;
                break;
            }
        }
        require!(found, PrizePoolError::NotAWinner);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct SetWinners<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 4 + 32*10 + 4 + 8*10 + 4 + 1*10 + 1)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct Claim<'info> {
    #[account(mut, has_one = pool_token_account)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub claimer_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is the PDA authority for the pool
    pub pool_authority: AccountInfo<'info>,
    pub claimer: Signer<'info>,
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
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Winners already set")]
    WinnersAlreadySet,
    #[msg("Winners not set")]
    WinnersNotSet,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Not a winner")]
    NotAWinner,
} 