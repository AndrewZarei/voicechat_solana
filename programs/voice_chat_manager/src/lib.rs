use anchor_lang::prelude::*;

declare_id!("GVqX9pcoxbiY7i1W3Ad6Sinw1pNpwUHq1tu4tpkH6TF8");

const MAX_VOICE_DATA_SIZE: usize = 29 * 1024; // Leave 1KB for metadata
const MAX_PARTICIPANTS: u8 = 10;
const MAX_ROOM_ID_LENGTH: usize = 32;

#[program]
pub mod voice_chat_manager {
    use super::*;

    /// Initialize voice chat room
    pub fn initialize_voice_room(
        ctx: Context<InitializeVoiceRoom>,
        room_id: String,
    ) -> Result<()> {
        require!(room_id.len() <= MAX_ROOM_ID_LENGTH, VoiceChatError::RoomIdTooLong);
        
        let voice_room = &mut ctx.accounts.voice_room;
        voice_room.room_id = room_id.clone();
        voice_room.host = ctx.accounts.host.key();
        voice_room.participant_count = 1; // Host is first participant
        voice_room.is_active = true;
        voice_room.created_at = Clock::get()?.unix_timestamp;
        voice_room.last_activity = Clock::get()?.unix_timestamp;
        
        msg!("Voice room '{}' created by {}", room_id, voice_room.host);
        Ok(())
    }

    /// Join voice chat room
    pub fn join_voice_room(ctx: Context<JoinVoiceRoom>) -> Result<()> {
        let voice_room = &mut ctx.accounts.voice_room;
        require!(voice_room.is_active, VoiceChatError::RoomNotActive);
        require!(voice_room.participant_count < MAX_PARTICIPANTS, VoiceChatError::RoomFull);
        
        voice_room.participant_count += 1;
        voice_room.last_activity = Clock::get()?.unix_timestamp;
        
        msg!("User {} joined room '{}'. Participants: {}", 
             ctx.accounts.participant.key(), 
             voice_room.room_id, 
             voice_room.participant_count);
        Ok(())
    }

    /// Send voice data to storage PDA
    pub fn send_voice_data(
        ctx: Context<SendVoiceData>,
        voice_data: Vec<u8>,
        target_pda_index: u8,
        sequence_number: u32,
    ) -> Result<()> {
        require!(voice_data.len() <= MAX_VOICE_DATA_SIZE, VoiceChatError::VoiceDataTooLarge);
        require!(target_pda_index < 10, VoiceChatError::InvalidStoragePDA);
        
        // Get storage PDA account info (from storage_manager contract)
        let storage_account_info = &ctx.accounts.storage_pda;
        let mut storage_data = storage_account_info.try_borrow_mut_data()?;
        
        // Calculate where to write in the 30KB storage
        // StoragePDA struct: discriminator(8) + index(1) + authority(32) + created_at(8) + data_length(4) + is_active(1) + data(30720)
        let metadata_size = 8 + 1 + 32 + 8 + 4 + 1;
        let data_start = metadata_size;
        
        // Write voice data to storage PDA
        let copy_len = std::cmp::min(voice_data.len(), MAX_VOICE_DATA_SIZE);
        storage_data[data_start..data_start + copy_len].copy_from_slice(&voice_data[..copy_len]);
        
        // Update data_length field in storage PDA
        let data_length_offset = 8 + 1 + 32 + 8; // offset to data_length field
        let new_length = copy_len as u32;
        storage_data[data_length_offset..data_length_offset + 4].copy_from_slice(&new_length.to_le_bytes());
        
        // Create voice message record
        let voice_message = &mut ctx.accounts.voice_message;
        voice_message.sender = ctx.accounts.sender.key();
        voice_message.room_id = ctx.accounts.voice_room.room_id.clone();
        voice_message.storage_pda_index = target_pda_index;
        voice_message.sequence_number = sequence_number;
        voice_message.data_length = voice_data.len() as u32;
        voice_message.timestamp = Clock::get()?.unix_timestamp;
        
        // Update room activity
        let voice_room = &mut ctx.accounts.voice_room;
        voice_room.last_activity = Clock::get()?.unix_timestamp;
        
        msg!("Voice data sent: {} bytes to PDA {}, sequence {}", 
             voice_data.len(), target_pda_index, sequence_number);
        Ok(())
    }

    /// Retrieve voice data from storage PDA
    pub fn get_voice_data(
        ctx: Context<GetVoiceData>,
        pda_index: u8,
    ) -> Result<()> {
        require!(pda_index < 10, VoiceChatError::InvalidStoragePDA);
        
        let storage_account_info = &ctx.accounts.storage_pda;
        let storage_data = storage_account_info.try_borrow_data()?;
        
        // Read metadata to get data length
        let data_length_offset = 8 + 1 + 32 + 8; // offset to data_length field
        let data_length = u32::from_le_bytes([
            storage_data[data_length_offset],
            storage_data[data_length_offset + 1],
            storage_data[data_length_offset + 2],
            storage_data[data_length_offset + 3],
        ]);
        
        msg!("Retrieved voice data from PDA {}: {} bytes", pda_index, data_length);
        Ok(())
    }

    /// Leave voice room
    pub fn leave_voice_room(ctx: Context<LeaveVoiceRoom>) -> Result<()> {
        let voice_room = &mut ctx.accounts.voice_room;
        if voice_room.participant_count > 0 {
            voice_room.participant_count -= 1;
        }
        
        voice_room.last_activity = Clock::get()?.unix_timestamp;
        
        // If no participants left, deactivate room
        if voice_room.participant_count == 0 {
            voice_room.is_active = false;
        }
        
        msg!("User {} left room '{}'. Participants: {}", 
             ctx.accounts.participant.key(), 
             voice_room.room_id, 
             voice_room.participant_count);
        Ok(())
    }

    /// Get room info
    pub fn get_room_info(ctx: Context<GetRoomInfo>) -> Result<()> {
        let voice_room = &ctx.accounts.voice_room;
        msg!("Room '{}': {} participants, active: {}, host: {}", 
             voice_room.room_id,
             voice_room.participant_count,
             voice_room.is_active,
             voice_room.host);
        Ok(())
    }

    /// Broadcast voice data to multiple PDAs (for group chat)
    pub fn broadcast_voice_data(
        ctx: Context<BroadcastVoiceData>,
        voice_data: Vec<u8>,
        target_pdas: Vec<u8>,
        sequence_number: u32,
    ) -> Result<()> {
        require!(voice_data.len() <= MAX_VOICE_DATA_SIZE, VoiceChatError::VoiceDataTooLarge);
        require!(target_pdas.len() <= 10, VoiceChatError::TooManyTargetPDAs);
        
        // Create broadcast message record
        let broadcast_message = &mut ctx.accounts.broadcast_message;
        broadcast_message.sender = ctx.accounts.sender.key();
        broadcast_message.room_id = ctx.accounts.voice_room.room_id.clone();
        broadcast_message.target_pdas = target_pdas.clone();
        broadcast_message.sequence_number = sequence_number;
        broadcast_message.data_length = voice_data.len() as u32;
        broadcast_message.timestamp = Clock::get()?.unix_timestamp;
        
        msg!("Voice data broadcasted: {} bytes to {} PDAs, sequence {}", 
             voice_data.len(), target_pdas.len(), sequence_number);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(room_id: String)]
pub struct InitializeVoiceRoom<'info> {
    #[account(
        init,
        payer = host,
        space = 8 + 4 + MAX_ROOM_ID_LENGTH + 32 + 1 + 1 + 8 + 8, // discriminator + room_id_len + room_id + host + participant_count + is_active + created_at + last_activity
        seeds = [b"voice_room", room_id.as_bytes()],
        bump
    )]
    pub voice_room: Account<'info, VoiceRoom>,
    
    #[account(mut)]
    pub host: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinVoiceRoom<'info> {
    #[account(mut)]
    pub voice_room: Account<'info, VoiceRoom>,
    
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(voice_data: Vec<u8>, target_pda_index: u8, sequence_number: u32)]
pub struct SendVoiceData<'info> {
    #[account(mut)]
    pub voice_room: Account<'info, VoiceRoom>,
    
    /// CHECK: This is the storage PDA from storage_manager contract
    #[account(mut)]
    pub storage_pda: AccountInfo<'info>,
    
    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 4 + MAX_ROOM_ID_LENGTH + 1 + 4 + 4 + 8, // discriminator + sender + room_id_len + room_id + storage_pda_index + sequence_number + data_length + timestamp
        seeds = [b"voice_message", sender.key().as_ref(), &sequence_number.to_le_bytes()],
        bump
    )]
    pub voice_message: Account<'info, VoiceMessage>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetVoiceData<'info> {
    pub voice_room: Account<'info, VoiceRoom>,
    
    /// CHECK: This is the storage PDA from storage_manager contract
    pub storage_pda: AccountInfo<'info>,
    
    pub requester: Signer<'info>,
}

#[derive(Accounts)]
pub struct LeaveVoiceRoom<'info> {
    #[account(mut)]
    pub voice_room: Account<'info, VoiceRoom>,
    
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetRoomInfo<'info> {
    pub voice_room: Account<'info, VoiceRoom>,
    
    pub requester: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(voice_data: Vec<u8>, target_pdas: Vec<u8>, sequence_number: u32)]
pub struct BroadcastVoiceData<'info> {
    #[account(mut)]
    pub voice_room: Account<'info, VoiceRoom>,
    
    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 4 + MAX_ROOM_ID_LENGTH + 10 + 4 + 4 + 8, // discriminator + sender + room_id_len + room_id + target_pdas + sequence_number + data_length + timestamp
        seeds = [b"broadcast_message", sender.key().as_ref(), &sequence_number.to_le_bytes()],
        bump
    )]
    pub broadcast_message: Account<'info, BroadcastMessage>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VoiceRoom {
    pub room_id: String,
    pub host: Pubkey,
    pub participant_count: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub last_activity: i64,
}

#[account]
pub struct VoiceMessage {
    pub sender: Pubkey,
    pub room_id: String,
    pub storage_pda_index: u8,
    pub sequence_number: u32,
    pub data_length: u32,
    pub timestamp: i64,
}

#[account]
pub struct BroadcastMessage {
    pub sender: Pubkey,
    pub room_id: String,
    pub target_pdas: Vec<u8>,
    pub sequence_number: u32,
    pub data_length: u32,
    pub timestamp: i64,
}

#[error_code]
pub enum VoiceChatError {
    #[msg("Voice room is not active")]
    RoomNotActive,
    #[msg("Voice room is full")]
    RoomFull,
    #[msg("Voice data exceeds maximum size")]
    VoiceDataTooLarge,
    #[msg("Invalid storage PDA index")]
    InvalidStoragePDA,
    #[msg("Room ID too long")]
    RoomIdTooLong,
    #[msg("Too many target PDAs for broadcast")]
    TooManyTargetPDAs,
}
