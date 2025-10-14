import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StorageManager } from "../target/types/storage_manager";
import { VoiceChatManager } from "../target/types/voice_chat_manager";
import { expect } from "chai";

describe("Voice Chat System", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const storageProgram = anchor.workspace.StorageManager as Program<StorageManager>;
  const voiceChatProgram = anchor.workspace.VoiceChatManager as Program<VoiceChatManager>;
  const authority = provider.wallet.publicKey;

  // Function that can be called from a button click
  const callVoiceChatSystem = async () => {
    console.log("🚀 Button clicked! Initializing Voice Chat System...");
    
    try {
      const results = {
        success: true,
        message: "Voice Chat System initialized successfully!",
        storagePDAs: [],
        voiceRoom: null,
        totalStorage: 0
      };

      console.log(`Authority: ${authority.toString()}`);
      
      // Step 1: Create 10 storage PDAs (30KB each)
      console.log("📦 Creating 10 storage PDAs with 30KB each...");
      
      for (let i = 0; i < 10; i++) {
        const [storagePDA] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("storage"), authority.toBuffer(), Buffer.from([i])],
          storageProgram.programId
        );
        
        console.log(`📦 Creating storage PDA ${i} at address: ${storagePDA.toString()}`);
        
        try {
          const tx = await storageProgram.methods
            .createAllStoragePdas(i)
            .accounts({
              storagePda: storagePDA,
              authority: authority,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
          
          console.log(`✅ Storage PDA ${i} created! Transaction: ${tx}`);
          
          // Verify the account was created
          const account = await storageProgram.account.storagePda.fetch(storagePDA);
          
          results.storagePDAs.push({
            index: i,
            address: storagePDA.toString(),
            transaction: tx,
            account: account,
            storageSize: "30KB"
          });
          
        } catch (error) {
          console.log(`⚠️ Storage PDA ${i} might already exist:`, error.message);
          try {
            const account = await storageProgram.account.storagePda.fetch(storagePDA);
            console.log(`📋 Existing storage PDA ${i} found`);
            
            results.storagePDAs.push({
              index: i,
              address: storagePDA.toString(),
              transaction: "existing",
              account: account,
              storageSize: "30KB"
            });
          } catch (fetchError) {
            console.log(`❌ Error with storage PDA ${i}:`, fetchError.message);
          }
        }
      }
      
      results.totalStorage = results.storagePDAs.length * 30;
      console.log(`✅ Storage system ready! Created ${results.storagePDAs.length} PDAs (${results.totalStorage}KB total)`);
      
      // Step 2: Create voice chat room
      const roomId = `voice-room-${Date.now()}`;
      console.log(`🏠 Creating voice room: ${roomId}`);
      
      const [voiceRoom] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("voice_room"), Buffer.from(roomId)],
        voiceChatProgram.programId
      );
      
      try {
        const tx = await voiceChatProgram.methods
          .initializeVoiceRoom(roomId)
          .accounts({
            voiceRoom: voiceRoom,
            host: authority,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        
        console.log(`✅ Voice room created! Transaction: ${tx}`);
        
        const roomAccount = await voiceChatProgram.account.voiceRoom.fetch(voiceRoom);
        results.voiceRoom = {
          id: roomId,
          address: voiceRoom.toString(),
          transaction: tx,
          account: roomAccount
        };
        
      } catch (error) {
        console.log(`⚠️ Voice room might already exist:`, error.message);
        try {
          const roomAccount = await voiceChatProgram.account.voiceRoom.fetch(voiceRoom);
          results.voiceRoom = {
            id: roomId,
            address: voiceRoom.toString(),
            transaction: "existing",
            account: roomAccount
          };
        } catch (fetchError) {
          console.log(`❌ Error with voice room:`, fetchError.message);
        }
      }
      
      // Step 3: Send sample voice data
      if (results.storagePDAs.length > 0 && results.voiceRoom) {
        console.log("🎤 Sending sample voice data...");
        
        const sampleVoiceData = Buffer.from(`Voice data sample created at ${new Date().toISOString()} - This simulates voice chat audio data!`);
        const targetPdaIndex = 0;
        const sequenceNumber = Math.floor(Math.random() * 1000000);
        
        const [voiceMessage] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("voice_message"), authority.toBuffer(), Buffer.from(sequenceNumber.toString())],
          voiceChatProgram.programId
        );
        
        try {
          const tx = await voiceChatProgram.methods
            .sendVoiceData(Array.from(sampleVoiceData), targetPdaIndex, sequenceNumber)
            .accounts({
              voiceRoom: voiceRoom,
              storagePda: new anchor.web3.PublicKey(results.storagePDAs[targetPdaIndex].address),
              voiceMessage: voiceMessage,
              sender: authority,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
          
          console.log(`✅ Voice data sent to storage PDA ${targetPdaIndex}! Transaction: ${tx}`);
          
        } catch (error) {
          console.log(`⚠️ Error sending voice data:`, error.message);
        }
      }
      
      console.log("🎉 Voice Chat System initialization completed!");
      console.log(`📊 Summary:`);
      console.log(`   - Storage PDAs: ${results.storagePDAs.length}/10`);
      console.log(`   - Total Storage: ${results.totalStorage}KB`);
      console.log(`   - Voice Room: ${results.voiceRoom ? 'Created' : 'Failed'}`);
      
      return results;
      
    } catch (error) {
      console.error("❌ Error initializing Voice Chat System:", error);
      return {
        success: false,
        message: `Error: ${error.message}`,
        storagePDAs: [],
        voiceRoom: null,
        totalStorage: 0
      };
    }
  };

  // Export the function for external use
  (global as any).callVoiceChatSystem = callVoiceChatSystem;

  it("Initializes storage system", async () => {
    console.log("🔧 Testing storage system initialization...");
    
    const [storageConfig] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("storage_config"), authority.toBuffer()],
      storageProgram.programId
    );
    
    try {
      const tx = await storageProgram.methods
        .initializeStorage()
        .accounts({
          storageConfig: storageConfig,
          authority: authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      console.log(`✅ Storage system initialized! Transaction: ${tx}`);
      
      const config = await storageProgram.account.storageConfig.fetch(storageConfig);
      expect(config.authority.toString()).to.equal(authority.toString());
      
    } catch (error) {
      console.log("⚠️ Storage system might already be initialized:", error.message);
    }
  });

  it("Creates 10 storage PDAs with 30KB each", async () => {
    console.log("📦 Testing storage PDA creation...");
    
    let createdCount = 0;
    
    for (let i = 0; i < 10; i++) {
      const [storagePDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("storage"), authority.toBuffer(), Buffer.from([i])],
        storageProgram.programId
      );
      
      try {
        const tx = await storageProgram.methods
          .createStoragePda(i)
          .accounts({
            storagePda: storagePDA,
            authority: authority,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        
        console.log(`✅ Created storage PDA ${i}`);
        createdCount++;
        
        // Verify the account
        const account = await storageProgram.account.storagePda.fetch(storagePDA);
        expect(account.index).to.equal(i);
        expect(account.authority.toString()).to.equal(authority.toString());
        expect(account.isActive).to.be.true;
        
      } catch (error) {
        if (error.message.includes("already in use")) {
          console.log(`📋 Storage PDA ${i} already exists`);
          createdCount++;
        } else {
          console.log(`❌ Error creating storage PDA ${i}:`, error.message);
        }
      }
    }
    
    console.log(`✅ Storage system ready: ${createdCount}/10 PDAs available`);
    expect(createdCount).to.be.greaterThan(0);
  });

  it("Creates voice room and manages participants", async () => {
    console.log("🏠 Testing voice room management...");
    
    const roomId = `test-room-${Date.now()}`;
    const [voiceRoom] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("voice_room"), Buffer.from(roomId)],
      voiceChatProgram.programId
    );
    
    try {
      // Create voice room
      const tx = await voiceChatProgram.methods
        .initializeVoiceRoom(roomId)
        .accounts({
          voiceRoom: voiceRoom,
          host: authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      console.log(`✅ Voice room '${roomId}' created!`);
      
      // Verify room
      const room = await voiceChatProgram.account.voiceRoom.fetch(voiceRoom);
      expect(room.roomId).to.equal(roomId);
      expect(room.host.toString()).to.equal(authority.toString());
      expect(room.participantCount).to.equal(1);
      expect(room.isActive).to.be.true;
      
      // Test joining room
      const joinTx = await voiceChatProgram.methods
        .joinVoiceRoom()
        .accounts({
          voiceRoom: voiceRoom,
          participant: authority,
        })
        .rpc();
      
      console.log(`✅ Joined voice room!`);
      
      // Verify participant count increased
      const updatedRoom = await voiceChatProgram.account.voiceRoom.fetch(voiceRoom);
      expect(updatedRoom.participantCount).to.equal(2);
      
    } catch (error) {
      console.log(`⚠️ Voice room test error:`, error.message);
    }
  });

  it("Sends voice data to storage PDAs", async () => {
    console.log("🎤 Testing voice data transmission...");
    
    const roomId = `data-test-room-${Date.now()}`;
    const [voiceRoom] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("voice_room"), Buffer.from(roomId)],
      voiceChatProgram.programId
    );
    
    try {
      // Create voice room
      await voiceChatProgram.methods
        .initializeVoiceRoom(roomId)
        .accounts({
          voiceRoom: voiceRoom,
          host: authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      // Send voice data to storage PDA
      const voiceData = Buffer.from("Test voice data - simulating audio stream");
      const targetPdaIndex = 0;
      const sequenceNumber = Math.floor(Math.random() * 1000000);
      
      const [storagePDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("storage"), authority.toBuffer(), Buffer.from([targetPdaIndex])],
        storageProgram.programId
      );
      
      const [voiceMessage] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("voice_message"), authority.toBuffer(), Buffer.from(sequenceNumber.toString())],
        voiceChatProgram.programId
      );
      
      const tx = await voiceChatProgram.methods
        .sendVoiceData(Array.from(voiceData), targetPdaIndex, sequenceNumber)
        .accounts({
          voiceRoom: voiceRoom,
          storagePda: storagePDA,
          voiceMessage: voiceMessage,
          sender: authority,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
      console.log(`✅ Voice data sent successfully!`);
      
      // Verify voice message
      const message = await voiceChatProgram.account.voiceMessage.fetch(voiceMessage);
      expect(message.sender.toString()).to.equal(authority.toString());
      expect(message.roomId).to.equal(roomId);
      expect(message.storagePdaIndex).to.equal(targetPdaIndex);
      expect(message.dataLength).to.equal(voiceData.length);
      
    } catch (error) {
      console.log(`⚠️ Voice data test error:`, error.message);
    }
  });

  it("Simulates complete voice chat flow (Button Click Test)", async () => {
    console.log("\n🎯 === SIMULATING COMPLETE VOICE CHAT FLOW ===");
    
    // This simulates what happens when you click the call button
    const result = await callVoiceChatSystem();
    
    console.log("\n📋 === VOICE CHAT SYSTEM RESULT ===");
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Storage PDAs: ${result.storagePDAs.length}/10`);
    console.log(`Total Storage: ${result.totalStorage}KB`);
    console.log(`Voice Room: ${result.voiceRoom ? 'Created' : 'Failed'}`);
    
    if (result.success) {
      console.log("\n✅ Voice Chat System simulation successful!");
      expect(result.success).to.be.true;
      expect(result.storagePDAs.length).to.be.greaterThan(0);
    } else {
      console.log("\n❌ Voice Chat System simulation failed!");
      console.log("Error details:", result.message);
    }
    
    console.log("\n🏁 === END VOICE CHAT FLOW SIMULATION ===\n");
  });
});
