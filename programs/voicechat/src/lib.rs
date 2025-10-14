use anchor_lang::prelude::*;

declare_id!("HPxbCqRWpSxCEE2L6Vy1S1oMTc3D9aknrBGwZ9WTAvSK");

const DATA_SIZE: usize = 30 * 1024; // 30KB per PDA - allocated upfront, not reallocated
const MAX_PDAS: u16 = 10; // Create 10 PDAs to get total 300KB (10 * 30KB)

#[program]
pub mod voicechat {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Initializing VoiceChat program: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn create_pda_account(
        ctx: Context<CreatePDAAccount>,
        pda_index: u16,
        data: Vec<u8>,
    ) -> Result<()> {
        require!(pda_index < MAX_PDAS, VoiceChatError::InvalidPDAIndex);
        require!(data.len() <= DATA_SIZE, VoiceChatError::DataTooLarge);

        let pda_account = &mut ctx.accounts.pda_account;
        pda_account.index = pda_index;
        pda_account.authority = ctx.accounts.authority.key();
        pda_account.created_at = Clock::get()?.unix_timestamp;
        pda_account.data_length = data.len() as u32;
        
        // Write data to the account's data section
        let account_info = pda_account.to_account_info();
        let mut account_data = account_info.try_borrow_mut_data()?;
        let data_start = 8 + 2 + 32 + 8 + 4; // Skip the struct fields (index is now u16 = 2 bytes)
        
        if !data.is_empty() {
            let copy_len = std::cmp::min(data.len(), DATA_SIZE);
            account_data[data_start..data_start + copy_len].copy_from_slice(&data[..copy_len]);
        }

        msg!("Created PDA account {} with {} bytes of data", pda_index, data.len());
        Ok(())
    }

    pub fn create_all_pdas(ctx: Context<CreateAllPDAs>, pda_index: u16) -> Result<()> {
        msg!("Creating PDA account {} for authority: {}", pda_index, ctx.accounts.authority.key());
        
        require!(pda_index < MAX_PDAS, VoiceChatError::InvalidPDAIndex);
        
        // Initialize the PDA with 30KB of space (allocated upfront)
        let pda_account = &mut ctx.accounts.pda_account;
        pda_account.index = pda_index;
        pda_account.authority = ctx.accounts.authority.key();
        pda_account.created_at = Clock::get()?.unix_timestamp;
        pda_account.data_length = 0; // No initial data
        
        // Initialize the data section with zeros
        let account_info = pda_account.to_account_info();
        let mut account_data = account_info.try_borrow_mut_data()?;
        let data_start = 8 + 2 + 32 + 8 + 4; // Skip the struct fields (index is now u16 = 2 bytes)
        
        // Fill with zeros (this is the default but being explicit)
        for i in data_start..data_start + DATA_SIZE {
            account_data[i] = 0;
        }

        msg!("PDA account {} created successfully with {}KB of space", pda_index, DATA_SIZE / 1024);
        Ok(())
    }

    pub fn update_pda_data(
        ctx: Context<UpdatePDAData>,
        new_data: Vec<u8>,
    ) -> Result<()> {
        require!(new_data.len() <= DATA_SIZE, VoiceChatError::DataTooLarge);

        let pda_account = &mut ctx.accounts.pda_account;
        pda_account.data_length = new_data.len() as u32;
        
        // Update the data in the account's data section
        let account_info = pda_account.to_account_info();
        let mut account_data = account_info.try_borrow_mut_data()?;
        let data_start = 8 + 2 + 32 + 8 + 4; // Skip the struct fields (index is now u16 = 2 bytes)
        
        // Update the data
        let copy_len = std::cmp::min(new_data.len(), DATA_SIZE);
        account_data[data_start..data_start + copy_len].copy_from_slice(&new_data[..copy_len]);
        
        // Clear remaining bytes if new data is smaller
        if copy_len < DATA_SIZE {
            for i in data_start + copy_len..data_start + DATA_SIZE {
                account_data[i] = 0;
            }
        }

        msg!("Updated PDA account {} with {} bytes of data", pda_account.index, new_data.len());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction(pda_index: u16)]
pub struct CreatePDAAccount<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 2 + 32 + 8 + 4 + DATA_SIZE, // discriminator + index(u16) + authority + created_at + data_length + data
        seeds = [b"pda", authority.key().as_ref(), &pda_index.to_le_bytes()],
        bump
    )]
    pub pda_account: Account<'info, PDAAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pda_index: u16)]
pub struct CreateAllPDAs<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 2 + 32 + 8 + 4 + DATA_SIZE, // discriminator + index(u16) + authority + created_at + data_length + data
        seeds = [b"pda", authority.key().as_ref(), &pda_index.to_le_bytes()],
        bump
    )]
    pub pda_account: Account<'info, PDAAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePDAData<'info> {
    #[account(
        mut,
        seeds = [b"pda", authority.key().as_ref(), &pda_account.index.to_le_bytes()],
        bump,
        has_one = authority
    )]
    pub pda_account: Account<'info, PDAAccount>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct PDAAccount {
    pub index: u16,
    pub authority: Pubkey,
    pub created_at: i64,
    pub data_length: u32,
    // The actual data will be stored as raw bytes after the struct
}

#[error_code]
pub enum VoiceChatError {
    #[msg("Invalid PDA index. Must be between 0 and 9.")]
    InvalidPDAIndex,
    #[msg("Data size exceeds maximum allowed size of 30KB.")]
    DataTooLarge,
}
