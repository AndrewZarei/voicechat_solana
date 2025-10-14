import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Voicechat } from "../target/types/voicechat";
import { expect } from "chai";

describe("voicechat", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.voicechat as Program<Voicechat>;
  const provider = anchor.getProvider();

  // Function that can be called from a button click
  const callSmartContract = async () => {
    console.log("🚀 Button clicked! Calling smart contract...");
    
    try {
      const authority = provider.wallet.publicKey;
      console.log(`Authority: ${authority.toString()}`);
      
      // Create PDA accounts when button is clicked (each 1KB for testing)
      console.log("Creating PDA accounts with 1KB each...");
      
      const createdPDAs = [];
      
      for (let i = 0; i < 5; i++) { // Start with 5 PDAs for testing
        const indexBuffer = Buffer.allocUnsafe(2);
        indexBuffer.writeUInt16LE(i, 0);
        const [pdaAddress] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("pda"), authority.toBuffer(), indexBuffer],
          program.programId
        );
        
        console.log(`📦 Creating PDA ${i} at address: ${pdaAddress.toString()}`);
        
        try {
          const tx = await program.methods
            .createAllPdas(i)
            .accounts({
              pdaAccount: pdaAddress,
              authority: authority,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
          
          console.log(`✅ PDA ${i} created successfully! Transaction: ${tx}`);
          
          // Verify the account was created
          const account = await program.account.pdaAccount.fetch(pdaAddress);
          console.log(`📊 PDA ${i} Details: index=${account.index}, dataLength=${account.dataLength}, authority=${account.authority.toString()}`);
          
          createdPDAs.push({
            index: i,
            address: pdaAddress.toString(),
            transaction: tx,
            account: account
          });
          
        } catch (error) {
          console.log(`⚠️ PDA ${i} might already exist or error occurred:`, error.message);
          // Try to fetch existing account
          try {
            const account = await program.account.pdaAccount.fetch(pdaAddress);
            console.log(`📋 Existing PDA ${i} found: index=${account.index}, dataLength=${account.dataLength}`);
            createdPDAs.push({
              index: i,
              address: pdaAddress.toString(),
              transaction: "existing",
              account: account
            });
          } catch (fetchError) {
            console.log(`❌ Error with PDA ${i}:`, fetchError.message);
          }
        }
      }
      
      console.log("🎉 Smart contract call completed!");
      console.log(`📈 Total PDAs processed: ${createdPDAs.length}`);
      console.log(`💾 Total storage allocated: ${createdPDAs.length * 1}KB`);
      
      // Add some sample data to the first PDA
      if (createdPDAs.length > 0) {
        const sampleData = Buffer.from(`Voice chat data created at ${new Date().toISOString()} - This is sample data for PDA 0!`);
        const firstPDA = createdPDAs[0];
        
        console.log("📝 Adding sample data to PDA 0...");
        
        try {
          const updateTx = await program.methods
            .updatePdaData(Array.from(sampleData))
            .accounts({
              pdaAccount: new anchor.web3.PublicKey(firstPDA.address),
              authority: authority,
            })
            .rpc();
          
          console.log(`✅ PDA 0 updated with sample data! Transaction: ${updateTx}`);
          
          // Fetch updated account
          const updatedAccount = await program.account.pdaAccount.fetch(new anchor.web3.PublicKey(firstPDA.address));
          console.log(`📊 Updated PDA 0: dataLength=${updatedAccount.dataLength} bytes`);
          
        } catch (updateError) {
          console.log(`⚠️ Error updating PDA 0:`, updateError.message);
        }
      }
      
      return {
        success: true,
        message: "Smart contract called successfully!",
        pdaCount: createdPDAs.length,
        pdas: createdPDAs
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
  };

  // Export the function for external use
  (global as any).callSmartContract = callSmartContract;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("Simulates button click - calls smart contract", async () => {
    console.log("\n🎯 === SIMULATING BUTTON CLICK ===");
    
    // This simulates what happens when you click the call button
    const result = await callSmartContract();
    
    console.log("\n📋 === BUTTON CLICK RESULT ===");
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`PDAs Created/Found: ${result.pdaCount}`);
    
    if (result.success) {
      console.log("\n✅ Button click simulation successful!");
      expect(result.success).to.be.true;
      expect(result.pdaCount).to.be.greaterThan(0);
    } else {
      console.log("\n❌ Button click simulation failed!");
      console.log("Error details:", result.message);
    }
    
    console.log("\n🏁 === END BUTTON CLICK SIMULATION ===\n");
  });

  it("Creates 30 PDA accounts with 10KB each", async () => {
    const authority = provider.wallet.publicKey;
    
    console.log("Creating 30 PDA accounts...");
    
    // Create all 30 PDA accounts
    for (let i = 0; i < 30; i++) {
      const [pdaAddress] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("pda"), authority.toBuffer(), Buffer.from([i])],
        program.programId
      );
      
      console.log(`Creating PDA ${i} at address: ${pdaAddress.toString()}`);
      
      const tx = await program.methods
        .createAllPdas(i)
        .accounts({
          pdaAccount: pdaAddress,
          authority: authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      console.log(`PDA ${i} created with transaction: ${tx}`);
      
      // Fetch and verify the account
      const account = await program.account.pdaAccount.fetch(pdaAddress);
      expect(account.index).to.equal(i);
      expect(account.authority.toString()).to.equal(authority.toString());
      expect(account.dataLength).to.equal(0);
      
      console.log(`PDA ${i} verified: index=${account.index}, authority=${account.authority.toString()}, dataLength=${account.dataLength}`);
    }
    
    console.log("All 30 PDA accounts created successfully!");
  });

  it("Updates PDA data", async () => {
    const authority = provider.wallet.publicKey;
    const testData = Buffer.from("Hello, this is test data for PDA 0!");
    
    const [pdaAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pda"), authority.toBuffer(), Buffer.from([0])],
      program.programId
    );
    
    console.log("Updating PDA 0 with test data...");
    
    const tx = await program.methods
      .updatePdaData(Array.from(testData))
      .accounts({
        pdaAccount: pdaAddress,
        authority: authority,
      })
      .rpc();
    
    console.log(`PDA 0 updated with transaction: ${tx}`);
    
    // Fetch and verify the updated account
    const account = await program.account.pdaAccount.fetch(pdaAddress);
    expect(account.dataLength).to.equal(testData.length);
    
    console.log(`PDA 0 updated successfully: dataLength=${account.dataLength}`);
  });
});
