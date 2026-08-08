import chat from '../../models/chat.js';
import user from '../../models/user.js';
import { geminiModelCall } from '../../llms/gemini/gemini.call.js';
import { groqModelCall } from '../../llms/groq/groq.call.js';
import { modelsList } from '../../constants/models.js';
import { updateBalance, userWalletBalance } from '../user/user.service.js';

export async function newChat(userId, model, provider, message) {
    let chatResponse;
    const finalMessage = `Format outputs using these rules:
    Currency: Always escape dollar signs with exactly one backslash (e.g. \\$50).
    Math/Variables: Use standard LaTeX wrapped in $ (inline) or $$ (block).
    CRITICAL BOUNDARY: Never place currency inside a LaTeX math block. Close the math block before writing currency amounts (e.g., write $R \\approx$ \\$3.4 billion, NOT $R \\approx \\$3.4$).
    These formatting rules should not affect the actual content explanation or examples.
    Message : ${message}
    `;
    const currentModel = modelsList.find((m) => m.model === model && m.provider === provider);
    const inputTokenCountCost = ((finalMessage.length*1.2)/4)*(currentModel.inputPrice);

    const currentUserBalance = await userWalletBalance(userId);

    if(currentUserBalance.statusCode !== 200) {
        return {status: "Failed", statusCode: 500, message: "Database error. Try again."};
    }
    if (currentUserBalance.walletBalance < inputTokenCountCost) {
        return {status: "Failed", statusCode: 402, message: "Insufficient funds"};
    }
    if (provider == 'gemini') {
        chatResponse = await geminiModelCall(model, finalMessage);
    }
    else if (provider == 'groq') {
        chatResponse = await groqModelCall(model, finalMessage);
    }
    if (chatResponse.statusCode == 500) {
        return {status : "Failed", statusCode: 500, message : `New chat failed with ${model}`};
    }
    const saveChat = await chat.create({
        userId : userId,
        latestModel : model,
        latestProvider: provider,
        originalModel: model,
        originalProvider: provider,
        messages : [
            {
                sender : "USER",
                message : message,
            },
            {
                sender : "LLM",
                message : chatResponse.response,
            }
        ],
        interactionId : provider == 'gemini' ? chatResponse?.interactionId : null,
    });

    if (!saveChat) {
        return {status : "Failed" , statusCode : 500, message : "Failed to save chat in database"};
    }
    
    const amount = (chatResponse.input_tokens * currentModel.inputPrice) + (chatResponse.output_tokens * currentModel.outputPrice);
    const updatedBalance = await updateBalance(userId, amount, 'sub');
    if (updatedBalance.statusCode !== 200) {
        return {status: "Failed", statusCode: 500, message : "Failed to update user balance"};
    }
    return {status : "Success", 
        statusCode : 201, 
        llmResponse: chatResponse.response,
        chatId: saveChat._id,
        walletBalance: updatedBalance.walletBalance,
        message: "New chat created" 
    };
};

export async function completeChat(chatId, userId, model, provider, message) {
    const pastChat = await chat.findOne({_id : chatId});
    let chatResponse;
    const currentModel = modelsList.find((m) => m.model === model && m.provider === provider);
    const currentUserBalance = await userWalletBalance(userId);
    if(currentUserBalance.statusCode !== 200) {
        return {status: "Failed", statusCode: 500, message: "Database error. Try again."};
    }
    if (pastChat.latestProvider == provider) {
        if (provider == 'gemini') {
            const inputTokenCountCost = ((message.length*1.2)/4)*(currentModel.inputPrice);
            
            if (currentUserBalance.walletBalance < inputTokenCountCost) {
                return {status: "Failed", statusCode: 402, message: "Insufficient funds"};
            }
            
            chatResponse = await geminiModelCall(model, message, pastChat.interactionId);
        } else if (provider == 'groq') {
            const finalMessage = `This is your past conversation with the user. Having context of it, now answer the next message sent by the user.
            Past messages : ${pastChat.messages}

            New message : ${message}`

            const inputTokenCountCost = ((finalMessage.length*1.2)/4)*(currentModel.inputPrice);
            
            if (currentUserBalance.walletBalance < inputTokenCountCost) {
                return {status: "Failed", statusCode: 402, message: "Insufficient funds"};
            }
            chatResponse = await groqModelCall(model, finalMessage);
        }
    } else {
        const finalMessage = `This is a past conversation with the user with a different LLM. Having context of it, now answer the next message sent by the user.
            Past messages : ${pastChat.messages}
            
            New message : ${message}`

            const inputTokenCountCost = ((finalMessage.length*1.2)/4)*(currentModel.inputPrice);
            
            if (currentUserBalance.walletBalance < inputTokenCountCost) {
                return {status: "Failed", statusCode: 402, message: "Insufficient funds"};
            }

        if (provider == 'gemini') {
            chatResponse = await geminiModelCall(model, finalMessage);
        }
        else if (provider == 'groq') {
            chatResponse = await groqModelCall(model, finalMessage);
        }
    }
    if (!chatResponse) {
        return {status : "Failed", statusCode : 500, message : "LLM response failed"};
    }

    const updatedChat = await chat.findOneAndUpdate({_id : chatId},
        { $push: {messages : { $each: [{sender : "USER", message : message}, {sender : "LLM", message : chatResponse.response} ] } }, 
        $set: {latestModel : model, latestProvider: provider, interactionId: (provider === 'gemini' ? chatResponse.interactionId : null)} },
        { new : true });

    if (!updatedChat) {
        return {status: "Failed", statusCode: 500, message : "Failed to update DB"};
    }
    const amount = (chatResponse.input_tokens * (currentModel.inputPrice)) + ((chatResponse.output_tokens+chatResponse?.thought_tokens) * (currentModel.outputPrice));
    const updatedBalance = await updateBalance(userId, amount, 'sub');
    if (updatedBalance.statusCode !== 200) {
        return {status: "Failed", statusCode: 500, message : "Failed to update user balance"};
    }
    return {status : "Success", 
        statusCode: 200, 
        llmResponse: chatResponse.response,
        walletBalance: updatedBalance.walletBalance,
        message : "Chat completed"
    };
}

export async function getAllChats(userId) {
    const allChats = await chat.find({userId : userId}).sort({ "updatedAt" : -1});
    if (!(allChats.length > 0)) {
        return {status: "Failed", statusCode: 404, message : "No chats found for user"};
    }
    return {status: "Success", statusCode: 200, message : "Chats found for user", chats: allChats};
}

export async function getChat(chatId) {
    const selectedChat = await chat.findOne({_id: chatId});
    if (!selectedChat) {
        return {status : "Failed", statusCode: 404, message: "No chat found"};
    }
    return {status: "Success", statusCode: 200, message : "Chat found", chat: selectedChat};
}