/**
 * Simple Voice Chat Demo
 * 
 * This demonstrates the core voice chat functionality without requiring
 * deployed smart contracts. It simulates the complete flow.
 */

class SimpleVoiceChatDemo {
    constructor() {
        this.rooms = new Map();
        this.messages = new Map();
        this.storage = new Map();
        this.users = new Map();
        
        console.log("🎙️ Simple Voice Chat Demo Initialized");
    }

    // Simulate user creation
    createUser(name) {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.users.set(userId, {
            id: userId,
            name: name,
            joinedRooms: [],
            messagesSent: 0
        });
        
        console.log(`👤 User created: ${name} (${userId.slice(0, 12)}...)`);
        return userId;
    }

    // Create voice chat room
    createRoom(hostUserId, roomName) {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.rooms.set(roomId, {
            id: roomId,
            name: roomName,
            host: hostUserId,
            participants: [hostUserId],
            isActive: true,
            createdAt: new Date(),
            lastActivity: new Date(),
            messageCount: 0
        });
        
        // Update user
        const user = this.users.get(hostUserId);
        user.joinedRooms.push(roomId);
        
        console.log(`🏠 Room created: "${roomName}" by ${user.name}`);
        console.log(`   Room ID: ${roomId.slice(0, 12)}...`);
        console.log(`   Participants: 1`);
        
        return roomId;
    }

    // Join voice chat room
    joinRoom(userId, roomId) {
        const room = this.rooms.get(roomId);
        const user = this.users.get(userId);
        
        if (!room) {
            throw new Error("Room not found");
        }
        
        if (!room.isActive) {
            throw new Error("Room is not active");
        }
        
        if (room.participants.includes(userId)) {
            throw new Error("User already in room");
        }
        
        if (room.participants.length >= 10) {
            throw new Error("Room is full (max 10 participants)");
        }
        
        room.participants.push(userId);
        room.lastActivity = new Date();
        user.joinedRooms.push(roomId);
        
        console.log(`👋 ${user.name} joined room "${room.name}"`);
        console.log(`   Participants: ${room.participants.length}/10`);
    }

    // Send voice message
    sendVoiceMessage(userId, roomId, voiceData, targetPDAIndex = 0) {
        const room = this.rooms.get(roomId);
        const user = this.users.get(userId);
        
        if (!room || !user) {
            throw new Error("Room or user not found");
        }
        
        if (!room.participants.includes(userId)) {
            throw new Error("User not in room");
        }
        
        if (voiceData.length > 29 * 1024) { // 29KB limit
            throw new Error("Voice data too large (max 29KB)");
        }
        
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sequenceNumber = room.messageCount + 1;
        
        // Store message
        this.messages.set(messageId, {
            id: messageId,
            sender: userId,
            roomId: roomId,
            voiceData: voiceData,
            targetPDAIndex: targetPDAIndex,
            sequenceNumber: sequenceNumber,
            dataLength: voiceData.length,
            timestamp: new Date()
        });
        
        // Update room and user stats
        room.messageCount++;
        room.lastActivity = new Date();
        user.messagesSent++;
        
        // Simulate storing in PDA
        const storageKey = `pda_${targetPDAIndex}`;
        if (!this.storage.has(storageKey)) {
            this.storage.set(storageKey, {
                index: targetPDAIndex,
                capacity: 30 * 1024, // 30KB
                used: 0,
                messages: []
            });
        }
        
        const storagePDA = this.storage.get(storageKey);
        if (storagePDA.used + voiceData.length > storagePDA.capacity) {
            throw new Error(`Storage PDA ${targetPDAIndex} full`);
        }
        
        storagePDA.used += voiceData.length;
        storagePDA.messages.push(messageId);
        
        console.log(`🗣️ ${user.name} sent voice message:`);
        console.log(`   Size: ${voiceData.length} bytes`);
        console.log(`   PDA: ${targetPDAIndex} (${storagePDA.used}/${storagePDA.capacity} bytes used)`);
        console.log(`   Sequence: ${sequenceNumber}`);
        console.log(`   Message ID: ${messageId.slice(0, 12)}...`);
        
        return messageId;
    }

    // Retrieve voice message
    getVoiceMessage(messageId) {
        const message = this.messages.get(messageId);
        if (!message) {
            throw new Error("Message not found");
        }
        
        const user = this.users.get(message.sender);
        const room = this.rooms.get(message.roomId);
        
        console.log(`📥 Retrieved voice message:`);
        console.log(`   From: ${user.name}`);
        console.log(`   Room: ${room.name}`);
        console.log(`   Size: ${message.dataLength} bytes`);
        console.log(`   Timestamp: ${message.timestamp.toISOString()}`);
        
        return message;
    }

    // Broadcast voice message to multiple PDAs
    broadcastVoiceMessage(userId, roomId, voiceData, targetPDAs) {
        const room = this.rooms.get(roomId);
        const user = this.users.get(userId);
        
        if (!room || !user) {
            throw new Error("Room or user not found");
        }
        
        if (targetPDAs.length > 10) {
            throw new Error("Too many target PDAs (max 10)");
        }
        
        const messageIds = [];
        
        for (const pdaIndex of targetPDAs) {
            try {
                const messageId = this.sendVoiceMessage(userId, roomId, voiceData, pdaIndex);
                messageIds.push(messageId);
            } catch (error) {
                console.log(`   ⚠️ Failed to broadcast to PDA ${pdaIndex}: ${error.message}`);
            }
        }
        
        console.log(`📡 Broadcast completed: ${messageIds.length}/${targetPDAs.length} successful`);
        return messageIds;
    }

    // Leave room
    leaveRoom(userId, roomId) {
        const room = this.rooms.get(roomId);
        const user = this.users.get(userId);
        
        if (!room || !user) {
            throw new Error("Room or user not found");
        }
        
        const participantIndex = room.participants.indexOf(userId);
        if (participantIndex === -1) {
            throw new Error("User not in room");
        }
        
        room.participants.splice(participantIndex, 1);
        room.lastActivity = new Date();
        
        const userRoomIndex = user.joinedRooms.indexOf(roomId);
        if (userRoomIndex !== -1) {
            user.joinedRooms.splice(userRoomIndex, 1);
        }
        
        // Deactivate room if empty
        if (room.participants.length === 0) {
            room.isActive = false;
            console.log(`🚪 ${user.name} left room "${room.name}" (room now empty and deactivated)`);
        } else {
            console.log(`🚪 ${user.name} left room "${room.name}" (${room.participants.length} participants remaining)`);
        }
    }

    // Get room info
    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error("Room not found");
        }
        
        const participantNames = room.participants.map(userId => {
            const user = this.users.get(userId);
            return user ? user.name : 'Unknown';
        });
        
        console.log(`📊 Room Info: "${room.name}"`);
        console.log(`   Status: ${room.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   Participants: ${room.participants.length}/10`);
        console.log(`   Users: [${participantNames.join(', ')}]`);
        console.log(`   Messages: ${room.messageCount}`);
        console.log(`   Created: ${room.createdAt.toISOString()}`);
        console.log(`   Last Activity: ${room.lastActivity.toISOString()}`);
        
        return room;
    }

    // Get storage info
    getStorageInfo() {
        console.log(`💾 Storage Info:`);
        
        for (const [key, storage] of this.storage) {
            const usagePercent = Math.round((storage.used / storage.capacity) * 100);
            console.log(`   PDA ${storage.index}: ${storage.used}/${storage.capacity} bytes (${usagePercent}%) - ${storage.messages.length} messages`);
        }
        
        const totalUsed = Array.from(this.storage.values()).reduce((sum, s) => sum + s.used, 0);
        const totalCapacity = Array.from(this.storage.values()).reduce((sum, s) => sum + s.capacity, 0);
        console.log(`   Total: ${totalUsed}/${totalCapacity} bytes`);
    }

    // Generate test voice data
    generateVoiceData(sizeInBytes) {
        return new Array(sizeInBytes).fill(0).map(() => Math.floor(Math.random() * 256));
    }

    // Run complete demo
    async runDemo() {
        console.log("\n🎯 Voice Chat System Demo");
        console.log("=".repeat(50));
        
        try {
            // Create users
            console.log("\n👥 Creating Users:");
            const alice = this.createUser("Alice");
            const bob = this.createUser("Bob");
            const charlie = this.createUser("Charlie");
            
            // Create room
            console.log("\n🏠 Room Management:");
            const roomId = this.createRoom(alice, "Daily Standup");
            
            // Users join
            this.joinRoom(bob, roomId);
            this.joinRoom(charlie, roomId);
            
            // Show room info
            this.getRoomInfo(roomId);
            
            // Voice messages
            console.log("\n🎙️ Voice Messages:");
            
            // Alice sends a greeting (5KB)
            const greeting = this.generateVoiceData(5000);
            const msg1 = this.sendVoiceMessage(alice, roomId, greeting, 0);
            
            // Bob responds (8KB)
            const response = this.generateVoiceData(8000);
            const msg2 = this.sendVoiceMessage(bob, roomId, response, 1);
            
            // Charlie asks a question (12KB)
            const question = this.generateVoiceData(12000);
            const msg3 = this.sendVoiceMessage(charlie, roomId, question, 2);
            
            // Alice broadcasts answer to everyone (15KB to 3 PDAs)
            console.log("\n📡 Broadcasting:");
            const answer = this.generateVoiceData(15000);
            this.broadcastVoiceMessage(alice, roomId, answer, [0, 1, 2]);
            
            // Retrieve messages
            console.log("\n📥 Message Retrieval:");
            this.getVoiceMessage(msg1);
            this.getVoiceMessage(msg2);
            this.getVoiceMessage(msg3);
            
            // Storage info
            console.log("\n💾 Storage Status:");
            this.getStorageInfo();
            
            // Users leave
            console.log("\n👋 Users Leaving:");
            this.leaveRoom(charlie, roomId);
            this.leaveRoom(bob, roomId);
            this.leaveRoom(alice, roomId);
            
            // Final room status
            console.log("\n📊 Final Room Status:");
            this.getRoomInfo(roomId);
            
            console.log("\n🎉 Demo Completed Successfully!");
            
        } catch (error) {
            console.error("\n💥 Demo Failed:", error.message);
        }
    }

    // Performance test
    async performanceTest() {
        console.log("\n⚡ Performance Test");
        console.log("-".repeat(30));
        
        const testUser = this.createUser("TestUser");
        const testRoom = this.createRoom(testUser, "Performance Test Room");
        
        const startTime = Date.now();
        
        // Send 20 messages rapidly
        for (let i = 0; i < 20; i++) {
            const voiceData = this.generateVoiceData(1000); // 1KB each
            this.sendVoiceMessage(testUser, testRoom, voiceData, i % 3);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Sent 20 messages in ${duration}ms`);
        console.log(`📊 Average: ${(duration / 20).toFixed(2)}ms per message`);
        console.log(`🚀 Throughput: ${(20000 / duration * 1000).toFixed(0)} messages/second`);
    }
}

// Main execution
async function main() {
    const demo = new SimpleVoiceChatDemo();
    
    // Run main demo
    await demo.runDemo();
    
    // Run performance test
    await demo.performanceTest();
    
    console.log("\n🏁 All Tests Complete!");
    console.log("\n💡 This demo simulates the complete voice chat flow:");
    console.log("   • Room creation and management");
    console.log("   • User joining/leaving");
    console.log("   • Voice message sending/receiving");
    console.log("   • Storage management (30KB PDAs)");
    console.log("   • Broadcasting to multiple users");
    console.log("   • Performance monitoring");
    console.log("\n🔧 To test with real smart contracts:");
    console.log("   1. Deploy contracts: anchor deploy");
    console.log("   2. Update program IDs in test files");
    console.log("   3. Run: node voice-chat-test.js");
}

// Export for use as module
module.exports = SimpleVoiceChatDemo;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
