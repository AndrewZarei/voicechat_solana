const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');

/**
 * Example demonstrating how to use the incremental reallocation feature
 * to grow a PDA account from 10KB to 1MB in 10KB chunks
 */
class ReallocationExample {
    constructor(programId, rpcUrl = "https://api.devnet.solana.com") {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.programId = new PublicKey(programId);
        this.provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(Keypair.generate()), // You should use your actual wallet
            { commitment: 'confirmed' }
        );
        this.program = new anchor.Program(
            require('./target/idl/voicechat.json'),
            this.programId,
            this.provider
        );
    }

    /**
     * Create a PDA account with initial 10KB size
     */
    async createPDAAccount(authority, pdaIndex, initialData = []) {
        try {
            const [pdaAddress] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("pda"),
                    authority.publicKey.toBuffer(),
                    Buffer.from(new Uint16Array([pdaIndex]).buffer)
                ],
                this.programId
            );

            console.log(`Creating PDA account ${pdaIndex} at address: ${pdaAddress.toString()}`);

            const tx = await this.program.methods
                .createPdaAccount(pdaIndex, initialData)
                .accounts({
                    pdaAccount: pdaAddress,
                    authority: authority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authority])
                .rpc();

            console.log(`✅ PDA account created with transaction: ${tx}`);
            console.log(`📏 Initial size: 10KB (10,240 bytes)`);
            
            return pdaAddress;
        } catch (error) {
            console.error("❌ Error creating PDA account:", error);
            throw error;
        }
    }

    /**
     * Incrementally reallocate PDA account to reach target size
     * This will be called multiple times due to 10KB reallocation limit
     */
    async reallocatePDAToTargetSize(authority, pdaAddress, targetSize) {
        try {
            console.log(`\n🔄 Starting reallocation to ${targetSize} bytes...`);
            
            // First, check how many steps we need
            await this.getReallocationStepsNeeded(authority, pdaAddress, targetSize);
            
            let currentIteration = 0;
            const maxIterations = Math.ceil((targetSize - 10240) / 10240); // (target - initial) / chunk_size
            
            while (currentIteration < maxIterations) {
                try {
                    console.log(`\n📈 Reallocation step ${currentIteration + 1}/${maxIterations}`);
                    
                    const tx = await this.program.methods
                        .reallocatePdaAccount(targetSize)
                        .accounts({
                            pdaAccount: pdaAddress,
                            authority: authority.publicKey,
                            systemProgram: SystemProgram.programId,
                        })
                        .signers([authority])
                        .rpc();

                    console.log(`✅ Reallocation step completed: ${tx}`);
                    
                    // Check current size
                    const accountInfo = await this.connection.getAccountInfo(pdaAddress);
                    const currentSize = accountInfo.data.length;
                    console.log(`📏 Current account size: ${currentSize} bytes`);
                    
                    if (currentSize >= targetSize) {
                        console.log(`🎉 Target size of ${targetSize} bytes reached!`);
                        break;
                    }
                    
                    currentIteration++;
                    
                    // Small delay between reallocations
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    if (error.message.includes("NoReallocNeeded")) {
                        console.log("✅ Account has already reached target size");
                        break;
                    }
                    throw error;
                }
            }
            
            // Final size check
            const finalAccountInfo = await this.connection.getAccountInfo(pdaAddress);
            console.log(`\n🏁 Final account size: ${finalAccountInfo.data.length} bytes`);
            
        } catch (error) {
            console.error("❌ Error during reallocation:", error);
            throw error;
        }
    }

    /**
     * Get information about reallocation steps needed
     */
    async getReallocationStepsNeeded(authority, pdaAddress, targetSize) {
        try {
            await this.program.methods
                .getReallocationStepsNeeded(targetSize)
                .accounts({
                    pdaAccount: pdaAddress,
                    authority: authority.publicKey,
                })
                .signers([authority])
                .rpc();
                
        } catch (error) {
            console.error("❌ Error getting reallocation info:", error);
        }
    }

    /**
     * Update PDA data (respects current account size)
     */
    async updatePDAData(authority, pdaAddress, newData) {
        try {
            const tx = await this.program.methods
                .updatePdaData(newData)
                .accounts({
                    pdaAccount: pdaAddress,
                    authority: authority.publicKey,
                })
                .signers([authority])
                .rpc();

            console.log(`✅ PDA data updated: ${tx}`);
            
        } catch (error) {
            console.error("❌ Error updating PDA data:", error);
            throw error;
        }
    }

    /**
     * Complete example: Create PDA and grow it to 1MB
     */
    async demonstrateReallocation() {
        try {
            console.log("🚀 Starting PDA Reallocation Demonstration");
            console.log("==========================================");
            
            // Generate a keypair for this example (use your actual keypair in production)
            const authority = Keypair.generate();
            
            // Airdrop some SOL for testing (devnet only)
            console.log("💰 Requesting airdrop...");
            const airdropTx = await this.connection.requestAirdrop(authority.publicKey, 2000000000); // 2 SOL
            await this.connection.confirmTransaction(airdropTx);
            
            // Step 1: Create PDA with initial 10KB
            const pdaAddress = await this.createPDAAccount(authority, 0, []);
            
            // Step 2: Reallocate to 1MB (1,048,576 bytes)
            const targetSize = 1048576; // 1MB
            await this.reallocatePDAToTargetSize(authority, pdaAddress, targetSize);
            
            // Step 3: Test updating with larger data
            const largeData = new Array(500000).fill(42); // 500KB of data
            await this.updatePDAData(authority, pdaAddress, largeData);
            
            console.log("\n🎉 Reallocation demonstration completed successfully!");
            console.log(`📍 PDA Address: ${pdaAddress.toString()}`);
            
        } catch (error) {
            console.error("❌ Demonstration failed:", error);
        }
    }
}

// Usage example
async function main() {
    const programId = "HPxbCqRWpSxCEE2L6Vy1S1oMTc3D9aknrBGwZ9WTAvSK"; // Your program ID
    const example = new ReallocationExample(programId);
    
    await example.demonstrateReallocation();
}

// Uncomment to run the example
// main().catch(console.error);

module.exports = ReallocationExample;
