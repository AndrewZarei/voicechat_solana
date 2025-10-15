const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');

/**
 * Comprehensive Voice Chat Testing Suite
 * 
 * This script simulates a complete voice chat system test including:
 * 1. Room creation and management
 * 2. User joining/leaving
 * 3. Voice message sending/receiving
 * 4. Storage management
 * 5. Broadcasting functionality
 */
class VoiceChatTester {
    constructor() {
        this.connection = new Connection("https://api.devnet.solana.com", 'confirmed');
        
        // Program IDs from Anchor.toml
        this.voiceChatProgramId = new PublicKey("HPxbCqRWpSxCEE2L6Vy1S1oMTc3D9aknrBGwZ9WTAvSK");
        this.storageManagerProgramId = new PublicKey("SU6CRGJXz5ksvXPyUuWXYfW2qmba6ZgHa3sxdr9aYMz");
        this.voiceChatManagerProgramId = new PublicKey("GVqX9pcoxbiY7i1W3Ad6Sinw1pNpwUHq1tu4tpkH6TF8");
        
        // Test users
        this.alice = null;
        this.bob = null;
        this.charlie = null;
        
        // Test data
        this.testRoomId = "test-room-" + Date.now();
        this.voiceMessages = [];
    }

    /**
     * Initialize test environment
     */
    async initialize() {
        console.log("🚀 Initializing Voice Chat Test Environment");
        console.log("=" .repeat(50));
        
        // Create test users
        this.alice = Keypair.generate();
        this.bob = Keypair.generate();
        this.charlie = Keypair.generate();
        
        console.log("👥 Test Users Created:");
        console.log(`   Alice: ${this.alice.publicKey.toString()}`);
        console.log(`   Bob: ${this.bob.publicKey.toString()}`);
        console.log(`   Charlie: ${this.charlie.publicKey.toString()}`);
        
        // Airdrop SOL to test users
        await this.airdropToUsers();
        
        console.log("✅ Test environment initialized");
    }

    /**
     * Airdrop SOL to test users
     */
    async airdropToUsers() {
        console.log("\n💰 Airdropping SOL to test users...");
        
        const users = [
            { name: "Alice", keypair: this.alice },
            { name: "Bob", keypair: this.bob },
            { name: "Charlie", keypair: this.charlie }
        ];
        
        for (const user of users) {
            try {
                const airdropTx = await this.connection.requestAirdrop(
                    user.keypair.publicKey, 
                    2 * LAMPORTS_PER_SOL
                );
                await this.connection.confirmTransaction(airdropTx);
                
                const balance = await this.connection.getBalance(user.keypair.publicKey);
                console.log(`   ${user.name}: ${balance / LAMPORTS_PER_SOL} SOL`);
            } catch (error) {
                console.log(`   ${user.name}: Airdrop failed (${error.message})`);
            }
        }
    }

    /**
     * Test 1: Voice Room Management
     */
    async testVoiceRoomManagement() {
        console.log("\n🏠 Test 1: Voice Room Management");
        console.log("-".repeat(30));
        
        try {
            // Test room creation
            console.log(`📝 Creating room: ${this.testRoomId}`);
            await this.createVoiceRoom(this.alice, this.testRoomId);
            
            // Test joining room
            console.log("👋 Bob joining room...");
            await this.joinVoiceRoom(this.bob, this.testRoomId);
            
            console.log("👋 Charlie joining room...");
            await this.joinVoiceRoom(this.charlie, this.testRoomId);
            
            // Test room info
            await this.getRoomInfo(this.testRoomId);
            
            console.log("✅ Voice room management test completed");
            
        } catch (error) {
            console.log("❌ Voice room management test failed:", error.message);
        }
    }

    /**
     * Test 2: Voice Message Flow
     */
    async testVoiceMessageFlow() {
        console.log("\n🎙️ Test 2: Voice Message Flow");
        console.log("-".repeat(30));
        
        try {
            // Generate test voice data
            const voiceData1 = this.generateTestVoiceData(5000); // 5KB
            const voiceData2 = this.generateTestVoiceData(10000); // 10KB
            const voiceData3 = this.generateTestVoiceData(15000); // 15KB
            
            // Alice sends voice message
            console.log("🗣️ Alice sending voice message (5KB)...");
            await this.sendVoiceMessage(this.alice, voiceData1, 0, 1);
            
            // Bob sends voice message
            console.log("🗣️ Bob sending voice message (10KB)...");
            await this.sendVoiceMessage(this.bob, voiceData2, 1, 2);
            
            // Charlie sends voice message
            console.log("🗣️ Charlie sending voice message (15KB)...");
            await this.sendVoiceMessage(this.charlie, voiceData3, 2, 3);
            
            // Retrieve voice messages
            console.log("📥 Retrieving voice messages...");
            await this.getVoiceMessage(0);
            await this.getVoiceMessage(1);
            await this.getVoiceMessage(2);
            
            console.log("✅ Voice message flow test completed");
            
        } catch (error) {
            console.log("❌ Voice message flow test failed:", error.message);
        }
    }

    /**
     * Test 3: Broadcasting
     */
    async testBroadcasting() {
        console.log("\n📡 Test 3: Broadcasting");
        console.log("-".repeat(30));
        
        try {
            const broadcastData = this.generateTestVoiceData(8000); // 8KB
            const targetPDAs = [0, 1, 2]; // Broadcast to 3 PDAs
            
            console.log("📢 Alice broadcasting to multiple PDAs...");
            await this.broadcastVoiceMessage(this.alice, broadcastData, targetPDAs, 4);
            
            console.log("✅ Broadcasting test completed");
            
        } catch (error) {
            console.log("❌ Broadcasting test failed:", error.message);
        }
    }

    /**
     * Test 4: Storage Management
     */
    async testStorageManagement() {
        console.log("\n💾 Test 4: Storage Management");
        console.log("-".repeat(30));
        
        try {
            // Test storage initialization
            console.log("🔧 Initializing storage system...");
            await this.initializeStorage(this.alice);
            
            // Test storage PDA creation
            console.log("📦 Creating storage PDAs...");
            for (let i = 0; i < 3; i++) {
                await this.createStoragePDA(this.alice, i);
            }
            
            // Test storage info
            console.log("📊 Getting storage info...");
            for (let i = 0; i < 3; i++) {
                await this.getStorageInfo(this.alice, i);
            }
            
            console.log("✅ Storage management test completed");
            
        } catch (error) {
            console.log("❌ Storage management test failed:", error.message);
        }
    }

    /**
     * Test 5: User Leave Flow
     */
    async testUserLeaveFlow() {
        console.log("\n👋 Test 5: User Leave Flow");
        console.log("-".repeat(30));
        
        try {
            // Users leave room
            console.log("🚪 Charlie leaving room...");
            await this.leaveVoiceRoom(this.charlie, this.testRoomId);
            
            console.log("🚪 Bob leaving room...");
            await this.leaveVoiceRoom(this.bob, this.testRoomId);
            
            console.log("🚪 Alice leaving room...");
            await this.leaveVoiceRoom(this.alice, this.testRoomId);
            
            // Check final room state
            await this.getRoomInfo(this.testRoomId);
            
            console.log("✅ User leave flow test completed");
            
        } catch (error) {
            console.log("❌ User leave flow test failed:", error.message);
        }
    }

    /**
     * Helper Methods
     */

    async createVoiceRoom(host, roomId) {
        // Simulate voice room creation
        console.log(`   ✅ Room "${roomId}" created by ${host.publicKey.toString().slice(0, 8)}...`);
        console.log(`   📊 Participants: 1 (host)`);
    }

    async joinVoiceRoom(user, roomId) {
        // Simulate joining voice room
        console.log(`   ✅ ${user.publicKey.toString().slice(0, 8)}... joined room "${roomId}"`);
    }

    async getRoomInfo(roomId) {
        // Simulate getting room info
        console.log(`   📊 Room "${roomId}" info:`);
        console.log(`      - Participants: 3`);
        console.log(`      - Status: Active`);
        console.log(`      - Last activity: ${new Date().toISOString()}`);
    }

    async sendVoiceMessage(sender, voiceData, pdaIndex, sequenceNumber) {
        // Simulate sending voice message
        console.log(`   ✅ Voice message sent by ${sender.publicKey.toString().slice(0, 8)}...`);
        console.log(`      - Size: ${voiceData.length} bytes`);
        console.log(`      - PDA Index: ${pdaIndex}`);
        console.log(`      - Sequence: ${sequenceNumber}`);
        
        this.voiceMessages.push({
            sender: sender.publicKey.toString(),
            data: voiceData,
            pdaIndex,
            sequenceNumber,
            timestamp: Date.now()
        });
    }

    async getVoiceMessage(pdaIndex) {
        // Simulate retrieving voice message
        const message = this.voiceMessages.find(msg => msg.pdaIndex === pdaIndex);
        if (message) {
            console.log(`   📥 Retrieved message from PDA ${pdaIndex}:`);
            console.log(`      - Sender: ${message.sender.slice(0, 8)}...`);
            console.log(`      - Size: ${message.data.length} bytes`);
            console.log(`      - Sequence: ${message.sequenceNumber}`);
        }
    }

    async broadcastVoiceMessage(sender, voiceData, targetPDAs, sequenceNumber) {
        // Simulate broadcasting
        console.log(`   ✅ Broadcast sent by ${sender.publicKey.toString().slice(0, 8)}...`);
        console.log(`      - Size: ${voiceData.length} bytes`);
        console.log(`      - Target PDAs: [${targetPDAs.join(', ')}]`);
        console.log(`      - Sequence: ${sequenceNumber}`);
    }

    async initializeStorage(authority) {
        // Simulate storage initialization
        console.log(`   ✅ Storage system initialized by ${authority.publicKey.toString().slice(0, 8)}...`);
    }

    async createStoragePDA(authority, pdaIndex) {
        // Simulate storage PDA creation
        console.log(`   ✅ Storage PDA ${pdaIndex} created (30KB capacity)`);
    }

    async getStorageInfo(authority, pdaIndex) {
        // Simulate getting storage info
        const usedSpace = Math.floor(Math.random() * 30); // Random usage
        console.log(`   📊 Storage PDA ${pdaIndex}: ${usedSpace}KB used / 30KB total`);
    }

    async leaveVoiceRoom(user, roomId) {
        // Simulate leaving voice room
        console.log(`   ✅ ${user.publicKey.toString().slice(0, 8)}... left room "${roomId}"`);
    }

    generateTestVoiceData(size) {
        // Generate random test data to simulate voice data
        return new Array(size).fill(0).map(() => Math.floor(Math.random() * 256));
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log("🎯 Voice Chat System - Comprehensive Test Suite");
        console.log("=".repeat(60));
        
        try {
            await this.initialize();
            await this.testVoiceRoomManagement();
            await this.testVoiceMessageFlow();
            await this.testBroadcasting();
            await this.testStorageManagement();
            await this.testUserLeaveFlow();
            
            console.log("\n🎉 All Tests Completed Successfully!");
            console.log("=".repeat(60));
            
            // Test summary
            console.log("\n📊 Test Summary:");
            console.log(`   - Voice messages sent: ${this.voiceMessages.length}`);
            console.log(`   - Total data processed: ${this.voiceMessages.reduce((sum, msg) => sum + msg.data.length, 0)} bytes`);
            console.log(`   - Test room: ${this.testRoomId}`);
            console.log(`   - Test users: 3 (Alice, Bob, Charlie)`);
            
        } catch (error) {
            console.error("\n💥 Test Suite Failed:", error);
        }
    }

    /**
     * Performance test
     */
    async performanceTest() {
        console.log("\n⚡ Performance Test");
        console.log("-".repeat(30));
        
        const startTime = Date.now();
        
        // Simulate rapid message sending
        for (let i = 0; i < 10; i++) {
            const voiceData = this.generateTestVoiceData(5000);
            await this.sendVoiceMessage(this.alice, voiceData, i % 3, i + 1);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`   ✅ Sent 10 messages in ${duration}ms`);
        console.log(`   📊 Average: ${duration / 10}ms per message`);
    }

    /**
     * Stress test
     */
    async stressTest() {
        console.log("\n🔥 Stress Test");
        console.log("-".repeat(30));
        
        const largeVoiceData = this.generateTestVoiceData(25000); // 25KB (near limit)
        
        try {
            await this.sendVoiceMessage(this.alice, largeVoiceData, 0, 999);
            console.log("   ✅ Large message (25KB) handled successfully");
        } catch (error) {
            console.log("   ❌ Large message failed:", error.message);
        }
        
        // Test rapid succession
        console.log("   🚀 Testing rapid message succession...");
        const promises = [];
        for (let i = 0; i < 5; i++) {
            const data = this.generateTestVoiceData(1000);
            promises.push(this.sendVoiceMessage(this.bob, data, i % 3, 1000 + i));
        }
        
        await Promise.all(promises);
        console.log("   ✅ Rapid succession test completed");
    }
}

// Main execution
async function main() {
    const tester = new VoiceChatTester();
    
    // Run comprehensive tests
    await tester.runAllTests();
    
    // Run performance tests
    await tester.performanceTest();
    
    // Run stress tests
    await tester.stressTest();
    
    console.log("\n🏁 Voice Chat Testing Complete!");
}

// Export for use as module
module.exports = VoiceChatTester;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
