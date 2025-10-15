# Solana PDA Reallocation Guide

This guide explains how to handle large account sizes (1MB) in Solana by working around the 10KB reallocation limit.

## Problem

Solana has a **10KB limit per reallocation operation**. This means you cannot directly create or resize an account to 1MB in a single instruction. You need to use incremental reallocation.

## Solution

Our implementation provides:

1. **Initial Creation**: PDAs start with 10KB (maximum initial size)
2. **Incremental Reallocation**: Grow accounts by 10KB chunks until reaching 1MB
3. **Dynamic Data Handling**: Update functions respect current account size

## Constants

```rust
const DATA_SIZE: usize = 1000 * 1024; // 1MB target size
const INITIAL_DATA_SIZE: usize = 10 * 1024; // 10KB initial size
const REALLOC_CHUNK_SIZE: usize = 10 * 1024; // 10KB per reallocation step
```

## Key Functions

### 1. `create_pda_account`
- Creates PDA with **10KB initial size**
- Can store up to 10KB of data initially
- Use this for initial account creation

### 2. `reallocate_pda_account`
- Grows account by up to 10KB per call
- Automatically handles rent calculations
- Must be called multiple times to reach 1MB
- **~100 calls needed** to reach 1MB from 10KB

### 3. `get_reallocation_steps_needed`
- Helper function to calculate required steps
- Shows current size, target size, and steps needed
- Useful for planning reallocation strategy

### 4. `update_pda_data`
- Respects current account size (not fixed 1MB)
- Dynamically calculates available space
- Safe to use at any account size

## Reallocation Process

To grow a PDA from 10KB to 1MB:

```javascript
// 1. Create initial 10KB PDA
const pdaAddress = await createPDAAccount(authority, 0, []);

// 2. Reallocate incrementally to 1MB
const targetSize = 1048576; // 1MB
let currentStep = 0;
const maxSteps = Math.ceil((targetSize - 10240) / 10240); // ~100 steps

while (currentStep < maxSteps) {
    try {
        await program.methods
            .reallocatePdaAccount(targetSize)
            .accounts({
                pdaAccount: pdaAddress,
                authority: authority.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
        
        currentStep++;
        
        // Check if target reached
        const accountInfo = await connection.getAccountInfo(pdaAddress);
        if (accountInfo.data.length >= targetSize) {
            break;
        }
        
    } catch (error) {
        if (error.message.includes("NoReallocNeeded")) {
            break; // Already at target size
        }
        throw error;
    }
}
```

## Cost Considerations

### Rent Costs
- **10KB**: ~0.0014 SOL
- **1MB**: ~0.14 SOL (100x more)
- Rent is calculated automatically during reallocation

### Transaction Costs
- **~100 transactions** needed to reach 1MB
- Each reallocation: ~0.000005 SOL transaction fee
- Total transaction cost: ~0.0005 SOL

### Total Cost Estimate
- **Rent**: ~0.14 SOL
- **Transactions**: ~0.0005 SOL
- **Total**: ~0.1405 SOL per 1MB PDA

## Error Handling

### New Error Codes
```rust
#[error_code]
pub enum VoiceChatError {
    #[msg("No reallocation needed - account is already at or above target size.")]
    NoReallocNeeded,
    #[msg("Target size exceeds maximum allowed size of 1MB.")]
    TargetSizeTooLarge,
    #[msg("Data size exceeds maximum allowed size of 1MB.")]
    DataTooLarge,
}
```

### Common Scenarios
- **NoReallocNeeded**: Account already at target size
- **TargetSizeTooLarge**: Trying to exceed 1MB limit
- **DataTooLarge**: Data exceeds current account capacity

## Best Practices

### 1. Batch Operations
```javascript
// Don't reallocate for every small data addition
// Instead, reallocate to anticipated size first
await reallocateToSize(pdaAddress, 500000); // 500KB
await updateData(pdaAddress, smallData1);
await updateData(pdaAddress, smallData2);
```

### 2. Progressive Reallocation
```javascript
// Reallocate as needed, not all at once
if (dataSize > currentAccountCapacity) {
    const targetSize = Math.min(dataSize + buffer, MAX_SIZE);
    await reallocateToSize(pdaAddress, targetSize);
}
```

### 3. Size Monitoring
```javascript
// Always check current size before operations
const accountInfo = await connection.getAccountInfo(pdaAddress);
const currentSize = accountInfo.data.length;
const availableSpace = currentSize - STRUCT_OVERHEAD;
```

## Example Usage

See `reallocation-example.js` for a complete working example that:
1. Creates a 10KB PDA
2. Reallocates it to 1MB
3. Stores 500KB of data
4. Demonstrates error handling

## Migration from 30KB Version

If you have existing 30KB PDAs:

1. **No migration needed** - they'll continue working
2. **New PDAs** start at 10KB and can grow to 1MB
3. **Update your client code** to handle reallocation
4. **Budget for higher costs** (~100x rent increase)

## Limitations

1. **10KB per instruction** - Solana's hard limit
2. **~100 transactions** needed for 1MB
3. **Higher costs** - 100x rent increase
4. **Time overhead** - Sequential reallocation takes time
5. **Network congestion** - Many transactions may face delays

## Alternative Approaches

If 1MB per PDA is too expensive or slow:

1. **Multiple smaller PDAs** - Use 100x 10KB PDAs instead
2. **Off-chain storage** - Store large data off-chain, keep hashes on-chain
3. **Compression** - Compress data before storing
4. **Tiered storage** - Hot data on-chain, cold data off-chain

## Conclusion

This implementation allows you to create 1MB PDAs while respecting Solana's constraints. The trade-offs are:

**Pros:**
- ✅ Achieves 1MB storage per PDA
- ✅ Handles reallocation automatically
- ✅ Maintains rent-exempt status
- ✅ Backward compatible

**Cons:**
- ❌ Requires ~100 transactions
- ❌ 100x higher rent costs
- ❌ Slower account creation
- ❌ More complex client code

Choose this approach when you need large contiguous storage and can accept the cost/complexity trade-offs.
