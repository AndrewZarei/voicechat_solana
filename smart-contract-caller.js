/**
 * Smart Contract Caller Module
 * This module provides functions to interact with the Voice Chat Solana smart contract
 */

import * as anchor from "@coral-xyz/anchor";

class SmartContractCaller {
    constructor(programId, rpcUrl = "https://api.devnet.solana.com") {
        this.programId = new anchor.web3.PublicKey(programId);
        this.connection = new anchor.web3.Connection(rpcUrl, "confirmed");
        this.program = null;
        this.wallet = null;
    }

    /**
     * Initialize the connection with a wallet
     * @param {Object} wallet - Solana wallet object (e.g., from Phantom)
     */
    async initialize(wallet) {
        this.wallet = wallet;
        
        const provider = new anchor.AnchorProvider(
            this.connection,
            wallet,
            { commitment: "confirmed" }
        );
        
        anchor.setProvider(provider);
        
        // Load the IDL - you'll need to import your generated IDL
        const idl = await anchor.Program.fetchIdl(this.programId, provider);
        this.program = new anchor.Program(idl, this.programId, provider);
        
        console.log("Smart contract caller initialized!");
    }

    /**
     * Main function to call when button is clicked
     * Creates 10 PDAs with 30KB each
     */
    async callSmartContract() {
        console.log("🚀 Button clicked! Calling smart contract...");
        
        if (!this.program || !this.wallet) {
            throw new Error("Smart contract caller not initialized. Call initialize() first.");
        }

        try {
            const authority = this.wallet.publicKey;
            console.log(`Authority: ${authority.toString()}`);
            
            // Create all 10 PDA accounts
            console.log("Creating 10 PDA accounts with 30KB each...");
            
            const createdPDAs = [];
            const transactions = [];
            
            // Create all PDAs in parallel for better performance
            const createPromises = [];
            
            for (let i = 0; i < 10; i++) {
                createPromises.push(this.createSinglePDA(i, authority));
            }
            
            const results = await Promise.allSettled(createPromises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    createdPDAs.push(result.value);
                    console.log(`✅ PDA ${index} created successfully!`);
                } else {
                    console.log(`⚠️ PDA ${index} failed:`, result.reason.message);
                }
            });
            
            console.log("🎉 Smart contract call completed!");
            console.log(`📈 Total PDAs processed: ${createdPDAs.length}`);
            
            // Add sample data to the first PDA if it was created
            if (createdPDAs.length > 0) {
                await this.addSampleDataToPDA(createdPDAs[0], authority);
            }
            
            return {
                success: true,
                message: "Smart contract called successfully!",
                pdaCount: createdPDAs.length,
                pdas: createdPDAs,
                totalStorageAllocated: `${createdPDAs.length * 30}KB`
            };
            
        } catch (error) {
            console.error("❌ Error calling smart contract:", error);
            return {
                success: false,
                message: `Error: ${error.message}`,
                pdaCount: 0,
                pdas: []
            };
        }
    }

    /**
     * Create a single PDA
     * @param {number} index - PDA index (0-9)
     * @param {PublicKey} authority - Authority public key
     */
    async createSinglePDA(index, authority) {
        const [pdaAddress] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("pda"), authority.toBuffer(), Buffer.from([index])],
            this.programId
        );
        
        console.log(`📦 Creating PDA ${index} at address: ${pdaAddress.toString()}`);
        
        try {
            const tx = await this.program.methods
                .createAllPdas(index)
                .accounts({
                    pdaAccount: pdaAddress,
                    authority: authority,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();
            
            // Verify the account was created
            const account = await this.program.account.pdaAccount.fetch(pdaAddress);
            
            return {
                index: index,
                address: pdaAddress.toString(),
                transaction: tx,
                account: account,
                storageSize: "30KB"
            };
            
        } catch (error) {
            // Try to fetch existing account
            try {
                const account = await this.program.account.pdaAccount.fetch(pdaAddress);
                console.log(`📋 Existing PDA ${index} found`);
                
                return {
                    index: index,
                    address: pdaAddress.toString(),
                    transaction: "existing",
                    account: account,
                    storageSize: "30KB"
                };
            } catch (fetchError) {
                throw new Error(`Failed to create or fetch PDA ${index}: ${error.message}`);
            }
        }
    }

    /**
     * Add sample data to a PDA
     * @param {Object} pda - PDA object
     * @param {PublicKey} authority - Authority public key
     */
    async addSampleDataToPDA(pda, authority) {
        const sampleData = Buffer.from(
            `Voice chat data created at ${new Date().toISOString()} - Sample data for PDA ${pda.index}!`
        );
        
        console.log(`📝 Adding sample data to PDA ${pda.index}...`);
        
        try {
            const updateTx = await this.program.methods
                .updatePdaData(Array.from(sampleData))
                .accounts({
                    pdaAccount: new anchor.web3.PublicKey(pda.address),
                    authority: authority,
                })
                .rpc();
            
            console.log(`✅ PDA ${pda.index} updated with sample data! Transaction: ${updateTx}`);
            
            // Fetch updated account
            const updatedAccount = await this.program.account.pdaAccount.fetch(
                new anchor.web3.PublicKey(pda.address)
            );
            
            pda.account = updatedAccount;
            pda.sampleDataAdded = true;
            
        } catch (updateError) {
            console.log(`⚠️ Error updating PDA ${pda.index}:`, updateError.message);
        }
    }

    /**
     * Get all PDAs for a given authority
     * @param {PublicKey} authority - Authority public key
     */
    async getAllPDAs(authority) {
        const pdas = [];
        
        for (let i = 0; i < 10; i++) {
            const [pdaAddress] = anchor.web3.PublicKey.findProgramAddressSync(
                [Buffer.from("pda"), authority.toBuffer(), Buffer.from([i])],
                this.programId
            );
            
            try {
                const account = await this.program.account.pdaAccount.fetch(pdaAddress);
                pdas.push({
                    index: i,
                    address: pdaAddress.toString(),
                    account: account,
                    exists: true
                });
            } catch (error) {
                pdas.push({
                    index: i,
                    address: pdaAddress.toString(),
                    account: null,
                    exists: false
                });
            }
        }
        
        return pdas;
    }
}

// Export for use in web applications
export default SmartContractCaller;

// Usage example:
/*
import SmartContractCaller from './smart-contract-caller.js';

// Initialize
const caller = new SmartContractCaller("YOUR_PROGRAM_ID_HERE");

// Connect wallet (e.g., Phantom)
const wallet = window.solana; // or your wallet connection
await caller.initialize(wallet);

// Call smart contract when button is clicked
document.getElementById('callButton').addEventListener('click', async () => {
    const result = await caller.callSmartContract();
    console.log('Result:', result);
});
*/

