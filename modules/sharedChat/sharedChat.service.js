import sharedChat from '../../models/sharedChat.js';
import chat from '../../models/chat.js';
import crypto from "crypto";

export async function createSharedChat(chatId, userId) {
    const selectedChat = await chat.findOne({_id : chatId}); 
    console.log(selectedChat);
    if (!selectedChat) {
        return {status: "Failed", statusCode: 404, message: "Chat not found"};
    }
    if (!selectedChat.userId.equals(userId)) {
        return {status: "Failed", statusCode: 401, message: "Unauthorized"};
    }
    const sharedChatCode = crypto.randomBytes(32).toString('hex');
    const newSharedChat = await sharedChat.create({
        chatId: chatId,
        ownerUserId: userId,
        chatCode: sharedChatCode,
    });

    if (!newSharedChat) {
        return {status: "Failed", statusCode: 500, message: "Failed to create shared chat code"};
    }
    
    return {status: "Success", statusCode: 201, message: "Created unique share chat code", sharedChatCode: sharedChatCode};

}

export async function getSharedChat(sharedChatCode) {
    const sharedChatDetails = await sharedChat.findOne({chatCode: sharedChatCode});
    if (!sharedChatDetails) {
        return {status: "Failed", statusCode: 404, message: "Shared chat details not found"};
    }

    const {chatId} = sharedChatDetails;
    const selectedChat = await chat.findOne({_id : chatId});
    if (!selectedChat) {
        return {status: "Failed", statusCode: 404, message: "Chat not found"};
    }

    return {status: "Success", statusCode: 200, message: "Shared chat found", chat: selectedChat};

}