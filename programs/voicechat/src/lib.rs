use anchor_lang::prelude::*;

declare_id!("HPxbCqRWpSxCEE2L6Vy1S1oMTc3D9aknrBGwZ9WTAvSK");

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
        require!(pda_index < 10, VoiceChatError::InvalidPDAIndex);
        require!(data.len() <= 10240, VoiceChatError::DataTooLarge);

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
            let copy_len = std::cmp::min(data.len(), 10240);
            account_data[data_start..data_start + copy_len].copy_from_slice(&data[..copy_len]);
        }

        msg!("Created PDA account {} with {} bytes of data", pda_index, data.len());
        Ok(())
    }

    pub fn create_all_pdas(ctx: Context<CreateAllPDAs>, pda_index: u16) -> Result<()> {
        msg!("Creating PDA account {} for authority: {}", pda_index, ctx.accounts.authority.key());
        
        require!(pda_index < 10, VoiceChatError::InvalidPDAIndex);
        
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
        for i in data_start..data_start + 1048576 {
            account_data[i] = 0;
        }

        msg!("PDA account {} created successfully with {}KB of space", pda_index, 1024);
        Ok(())
    }

    pub fn update_pda_data(
        ctx: Context<UpdatePDAData>,
        new_data: Vec<u8>,
    ) -> Result<()> {
        let account_info = ctx.accounts.pda_account.to_account_info();
        let current_account_size = account_info.data_len();
        let data_start = 8 + 2 + 32 + 8 + 4; // Skip the struct fields (index is now u16 = 2 bytes)
        let available_data_space = current_account_size.saturating_sub(data_start);
        
        require!(new_data.len() <= available_data_space, VoiceChatError::DataTooLarge);

        let pda_account = &mut ctx.accounts.pda_account;
        pda_account.data_length = new_data.len() as u32;
        
        // Update the data in the account's data section
        let mut account_data = account_info.try_borrow_mut_data()?;
        
        // Update the data
        let copy_len = std::cmp::min(new_data.len(), available_data_space);
        account_data[data_start..data_start + copy_len].copy_from_slice(&new_data[..copy_len]);
        
        // Clear remaining bytes if new data is smaller
        if copy_len < available_data_space {
            for i in data_start + copy_len..data_start + available_data_space {
                account_data[i] = 0;
            }
        }

        msg!("Updated PDA account {} with {} bytes of data (available space: {} bytes)", 
             pda_account.index, new_data.len(), available_data_space);
        Ok(())
    }

    /// Incrementally reallocate PDA account to reach target size
    /// Must be called multiple times to reach 1MB due to 10KB reallocation limit
    pub fn reallocate_pda_account(
        ctx: Context<ReallocatePDAAccount>,
        target_size: usize,
    ) -> Result<()> {
        let pda_account = ctx.accounts.pda_account.to_account_info();
        let current_size = pda_account.data_len();
        
        // Calculate how much we can grow in this instruction (max 10KB)
        let size_increase = std::cmp::min(target_size.saturating_sub(current_size), 10240);
        
        require!(size_increase > 0, VoiceChatError::NoReallocNeeded);
        require!(target_size <= 1048576 + 8 + 2 + 32 + 8 + 4, VoiceChatError::TargetSizeTooLarge); // Include struct overhead
        
        let new_size = current_size + size_increase;
        
        // Calculate additional rent needed
        let rent = Rent::get()?;
        let new_rent_exempt_balance = rent.minimum_balance(new_size);
        let current_lamports = pda_account.lamports();
        
        // Transfer additional lamports if needed
        if new_rent_exempt_balance > current_lamports {
            let lamports_needed = new_rent_exempt_balance - current_lamports;
            
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: pda_account.clone(),
                    },
                ),
                lamports_needed,
            )?;
        }
        
        // Perform the reallocation
        pda_account.resize(new_size)?;
        
        msg!("Reallocated PDA account from {} to {} bytes (increase: {} bytes)", 
             current_size, new_size, size_increase);
        
        // Check if we've reached the target size
        if new_size >= target_size {
            msg!("PDA account has reached target size of {} bytes", target_size);
        } else {
            msg!("PDA account needs {} more bytes to reach target size", target_size - new_size);
        }
        
        Ok(())
    }

    /// Helper function to calculate how many reallocation steps are needed
    pub fn get_reallocation_steps_needed(
        ctx: Context<GetReallocationInfo>,
        target_size: usize,
    ) -> Result<()> {
        let current_size = ctx.accounts.pda_account.to_account_info().data_len();
        let remaining_bytes = target_size.saturating_sub(current_size);
        let steps_needed = (remaining_bytes + 10240 - 1) / 10240; // Ceiling division
        
        msg!("Current size: {} bytes", current_size);
        msg!("Target size: {} bytes", target_size);
        msg!("Remaining bytes: {} bytes", remaining_bytes);
        msg!("Reallocation steps needed: {}", steps_needed);
        
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
        space = 8 + 2 + 32 + 8 + 4 + 10240, // discriminator + index(u16) + authority + created_at + data_length + initial_data
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
        space = 8 + 2 + 32 + 8 + 4 + 10240, // discriminator + index(u16) + authority + created_at + data_length + initial_data
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

#[derive(Accounts)]
pub struct ReallocatePDAAccount<'info> {
    #[account(
        mut,
        seeds = [b"pda", authority.key().as_ref(), &pda_account.index.to_le_bytes()],
        bump,
        has_one = authority
    )]
    pub pda_account: Account<'info, PDAAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetReallocationInfo<'info> {
    #[account(
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
    #[msg("Data size exceeds maximum allowed size of 1MB.")]
    DataTooLarge,
    #[msg("No reallocation needed - account is already at or above target size.")]
    NoReallocNeeded,
    #[msg("Target size exceeds maximum allowed size of 1MB.")]
    TargetSizeTooLarge,
}
