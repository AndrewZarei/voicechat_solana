use anchor_lang::prelude::*;

declare_id!("SU6CRGJXz5ksvXPyUuWXYfW2qmba6ZgHa3sxdr9aYMz");

const CHUNK_SIZE: usize = 30 * 1024; // 30KB per PDA
const MAX_STORAGE_PDAS: u8 = 10; // 10 PDAs total

#[program]
pub mod storage_manager {
    use super::*;

    /// Initialize the storage system
    pub fn initialize_storage(ctx: Context<InitializeStorage>) -> Result<()> {
        let storage_config = &mut ctx.accounts.storage_config;
        storage_config.authority = ctx.accounts.authority.key();
        storage_config.total_pdas = 0;
        storage_config.created_at = Clock::get()?.unix_timestamp;
        
        msg!("Storage system initialized for authority: {}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Create a single 30KB storage PDA
    pub fn create_storage_pda(
        ctx: Context<CreateStoragePDA>, 
        pda_index: u8
    ) -> Result<()> {
        require!(pda_index < MAX_STORAGE_PDAS, StorageError::InvalidPDAIndex);
        
        let storage_pda = &mut ctx.accounts.storage_pda;
        storage_pda.index = pda_index;
        storage_pda.authority = ctx.accounts.authority.key();
        storage_pda.created_at = Clock::get()?.unix_timestamp;
        storage_pda.data_length = 0;
        storage_pda.is_active = true;
        
        // Initialize 30KB data space with zeros
        storage_pda.data = [0u8; CHUNK_SIZE];
        
        msg!("Created storage PDA {} with 30KB capacity", pda_index);
        Ok(())
    }

    /// Create all 10 storage PDAs - batch creation helper
    pub fn create_all_storage_pdas(
        ctx: Context<CreateAllStoragePDAs>,
        pda_index: u8
    ) -> Result<()> {
        require!(pda_index < MAX_STORAGE_PDAS, StorageError::InvalidPDAIndex);
        
        let storage_pda = &mut ctx.accounts.storage_pda;
        storage_pda.index = pda_index;
        storage_pda.authority = ctx.accounts.authority.key();
        storage_pda.created_at = Clock::get()?.unix_timestamp;
        storage_pda.data_length = 0;
        storage_pda.is_active = true;
        storage_pda.data = [0u8; CHUNK_SIZE];
        
        msg!("Batch created storage PDA {} (30KB)", pda_index);
        Ok(())
    }

    /// Update storage PDA data (used by voice chat contract)
    pub fn update_storage_data(
        ctx: Context<UpdateStorageData>,
        new_data: Vec<u8>,
        offset: u32,
    ) -> Result<()> {
        require!(new_data.len() <= CHUNK_SIZE, StorageError::DataTooLarge);
        require!((offset as usize + new_data.len()) <= CHUNK_SIZE, StorageError::DataTooLarge);
        
        let storage_pda = &mut ctx.accounts.storage_pda;
        
        // Update data at specified offset
        let start_idx = offset as usize;
        let end_idx = start_idx + new_data.len();
        storage_pda.data[start_idx..end_idx].copy_from_slice(&new_data);
        
        // Update data length if we wrote beyond current length
        let new_length = std::cmp::max(storage_pda.data_length as usize, end_idx);
        storage_pda.data_length = new_length as u32;
        
        msg!("Updated storage PDA {} with {} bytes at offset {}", 
             storage_pda.index, new_data.len(), offset);
        Ok(())
    }

    /// Get storage info
    pub fn get_storage_info(ctx: Context<GetStorageInfo>) -> Result<()> {
        let storage_pda = &ctx.accounts.storage_pda;
        msg!("Storage PDA {}: {}KB used / 30KB total", 
             storage_pda.index, 
             storage_pda.data_length / 1024);
        Ok(())
    }

    /// Clear storage PDA data
    pub fn clear_storage_data(ctx: Context<ClearStorageData>) -> Result<()> {
        let storage_pda = &mut ctx.accounts.storage_pda;
        storage_pda.data = [0u8; CHUNK_SIZE];
        storage_pda.data_length = 0;
        
        msg!("Cleared storage PDA {}", storage_pda.index);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeStorage<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1 + 8, // discriminator + authority + total_pdas + created_at
        seeds = [b"storage_config", authority.key().as_ref()],
        bump
    )]
    pub storage_config: Account<'info, StorageConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pda_index: u8)]
pub struct CreateStoragePDA<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 1 + 32 + 8 + 4 + 1 + CHUNK_SIZE, // discriminator + index + authority + created_at + data_length + is_active + 30KB data
        seeds = [b"storage", authority.key().as_ref(), &[pda_index]],
        bump
    )]
    pub storage_pda: Account<'info, StoragePDA>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pda_index: u8)]
pub struct CreateAllStoragePDAs<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 1 + 32 + 8 + 4 + 1 + CHUNK_SIZE,
        seeds = [b"storage", authority.key().as_ref(), &[pda_index]],
        bump
    )]
    pub storage_pda: Account<'info, StoragePDA>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStorageData<'info> {
    #[account(
        mut,
        seeds = [b"storage", authority.key().as_ref(), &[storage_pda.index]],
        bump,
        has_one = authority
    )]
    pub storage_pda: Account<'info, StoragePDA>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetStorageInfo<'info> {
    #[account(
        seeds = [b"storage", authority.key().as_ref(), &[storage_pda.index]],
        bump
    )]
    pub storage_pda: Account<'info, StoragePDA>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClearStorageData<'info> {
    #[account(
        mut,
        seeds = [b"storage", authority.key().as_ref(), &[storage_pda.index]],
        bump,
        has_one = authority
    )]
    pub storage_pda: Account<'info, StoragePDA>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct StorageConfig {
    pub authority: Pubkey,
    pub total_pdas: u8,
    pub created_at: i64,
}

#[account]
pub struct StoragePDA {
    pub index: u8,
    pub authority: Pubkey,
    pub created_at: i64,
    pub data_length: u32,
    pub is_active: bool,
    pub data: [u8; CHUNK_SIZE], // 30KB storage
}

#[error_code]
pub enum StorageError {
    #[msg("Invalid PDA index. Must be 0-9.")]
    InvalidPDAIndex,
    #[msg("Data too large for storage PDA.")]
    DataTooLarge,
}
