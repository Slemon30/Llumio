import chat from '../../models/chat.js';
import user from '../../models/user.js';
import { geminiModelCall } from '../../llms/gemini/gemini.call.js';
import { groqModelCall } from '../../llms/groq/groq.call.js';
import { modelsList } from '../../constants/models.js';
import { updateBalance, userWalletBalance } from '../user/user.service.js';
import { summaryModel } from '../../constants/constants.js';

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
    let summaryMessage;
    if (pastChat?.chatSummary?.summary) {
        summaryMessage = await getSummaryMessage(pastChat, message);
        if (summaryMessage.statusCode !== 200) {
            return {status: "Failed", statusCode: 500, message: summaryMessage.message};
        } 
    }
    if (pastChat.latestProvider == provider) {
        if (provider == 'gemini') {
            const inputTokenCountCost = ((message.length*1.2)/4)*(currentModel.inputPrice);
            
            if (currentUserBalance.walletBalance < inputTokenCountCost) {
                return {status: "Failed", statusCode: 402, message: "Insufficient funds"};
            }
            let finalMessage = message;
            if (pastChat?.chatSummary?.summary) {
                finalMessage = summaryMessage.summaryMessage;
            }
            
            chatResponse = await geminiModelCall(model, finalMessage, pastChat.interactionId);
        } else if (provider == 'groq') {
            let finalMessage = `This is your past conversation with the user. Having context of it, now answer the next message sent by the user.
            Past messages : ${pastChat.messages}

            New message : ${message}`

            if (pastChat?.chatSummary?.summary) {
                finalMessage = summaryMessage.summaryMessage;
            }

            const inputTokenCountCost = ((finalMessage.length*1.2)/4)*(currentModel.inputPrice);
            
            if (currentUserBalance.walletBalance < inputTokenCountCost) {
                return {status: "Failed", statusCode: 402, message: "Insufficient funds"};
            }
            chatResponse = await groqModelCall(model, finalMessage);
        }
    } else {
        let finalMessage = `This is a past conversation with the user with a different LLM. Having context of it, now answer the next message sent by the user.
            Past messages : ${pastChat.messages}
            
            New message : ${message}`

            if (pastChat?.chatSummary?.summary) {
                finalMessage = summaryMessage.summaryMessage;
            }

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
    const summaryCost = (chatResponse.input_tokens * (summaryModel.inputPrice)) + ((chatResponse.output_tokens+chatResponse?.thought_tokens) * (summaryModel.outputPrice));
    if (chatResponse.input_tokens > 800) {
        generateChatSummary(chatId, userId)
            .then(res => {
                if (res?.statusCode !== 200) {
                    console.log("Background chat summary trigger failed:", res?.message);
                } else {
                    console.log("Background chat summary updated successfully for chat:", chatId);
                }
            })
            .catch(err => {
                console.error("Error in background generateChatSummary:", err);
            });
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

async function generateChatSummary(chatId, userId) {
    try {
        const pastChat = await chat.findOne({_id : chatId});
        if (!pastChat) {
            return {status : "Failed", statusCode: 404, message: "No chat found"};
        }
        
        let chatHistory;
        const lastSummaryTimestamp = pastChat?.chatSummary?.timestamp || 0;

        for(let i = pastChat.messages.length-1; i>=0; i-=1) {
            if (pastChat.messages[i].timestamp > lastSummaryTimestamp) {
                chatHistory = `${pastChat.messages[i]}` + ` ${chatHistory}`;
            }
            else {
                break;
            }
        }
        const summaryPromptRules = `You are an advanced state-preservation engine for a multi-model software engineering chat platform. Your task is to update and consolidate an ongoing conversation history into a single, highly compressed context block so that an AI can get full context of the conversation so far.
        Format outputs using these rules:
        Currency: Always escape dollar signs with exactly one backslash (e.g. \\$50).
        Math/Variables: Use standard LaTeX wrapped in $ (inline) or $$ (block).
        CRITICAL BOUNDARY: Never place currency inside a LaTeX math block. Close the math block before writing currency amounts (e.g., write $R \\approx$ \\$3.4 billion, NOT $R \\approx \\$3.4$).
        These formatting rules should not affect the actual content explanation or examples.
        
        CRITICAL CONSTRAINTS & PRESERVATION RULES:
        CODE SNIPPETS: Keep all critical code blocks, configuration snippets, SQL queries, JSON payloads, and terminal commands completely intact or verbatim. Do not truncate code into pseudo-code unless it is trivial boilerplate.
        FORMATTING & MEDIA: Retain exact markdown structures, file paths, image/media references, and URLs mentioned in the conversation.
        USER INSTRUCTIONS: Explicitly preserve any active constraints, formatting requirements, or specific rules requested by the user.
        TECHNICAL STATE: Maintain an explicit record of architectural decisions, libraries chosen, database schemas, and known bugs or errors being debugged.
        
        Apply only appropriate constraints and rules.`
        
        const summaryPromptInput=`INPUT DATA:
        [NEW CONVERSATION TURNS TO COMPRESS]
        ${chatHistory}`

        const summaryPromptOutput = `OUTPUT FORMAT:
        Provide the updated summary organized under clear markdown headers:
        - Current Objective & Active User Instructions
        - Key Technical Decisions & Architecture State
        - Preserved Code Blocks & File References
        - Recent Progress & Unresolved Bugs`

        let finalMessage = `${summaryPromptInput}`;
        let existingSummaryPrompt;
        if (pastChat?.chatSummary) {
            existingSummaryPrompt = `Existing Chat Summary:
            ${pastChat.chatSummary.summary}`;
            finalMessage = `${finalMessage} \n ${existingSummaryPrompt}`;
        }
        finalMessage = `${finalMessage} \n ${summaryPromptRules} \n ${summaryPromptOutput}`;

        const newSummary = await geminiModelCall(summaryModel.model, finalMessage);
        if (newSummary.statusCode !== 200) {
            return {status: "Failed", statusCode: 500, message: "Failed to summarize chat"};
        }

        const updateChatSummary = await chat.findOneAndUpdate({_id : chatId},
            {$set : {"chatSummary.summary" : newSummary.response, "chatSummary.timestamp" : Date.now()}},
            {new : true}
        );

        if (!updateChatSummary) {
            return {status: "Failed", statusCode: 500, message: "Failed to update chat summary in DB"};
        }

        const amount = (newSummary.input_tokens * (summaryModel.inputPrice)) + ((newSummary.output_tokens + newSummary?.thought_tokens) * (summaryModel.outputPrice));
        const updatedBalance = await updateBalance(userId, amount, 'sub');
        if (updatedBalance.statusCode !== 200) {
            return {status: "Failed", statusCode: 500, message : "Failed to update user balance"};
        }

        return {status: "Success", statusCode: 200, message: "Chat Summary updated"};
    } catch (error) {
        console.log(`Error is summarizing chat : ${error.message} : ${error.stack}`);
    }
}

async function getSummaryMessage(pastChat, userMessage) {
    try {
        let messagesAfterSummary;
        const lastSummaryTimestamp = pastChat?.chatSummary?.timestamp;
        for(let i = pastChat.messages.length-1; i>=0; i-=1) {
            if (pastChat.messages[i].timestamp >= lastSummaryTimestamp) {
                messagesAfterSummary = `${pastChat.messages[i]}` + ` ${messagesAfterSummary}`;
            }
            else {
                break;
            }
        }

        const summaryMessage = `Below is the content of the conversation so far, followed by the latest message from the user. \n
        Summary : ${pastChat.chatSummary.summary} \n

        Recent messages after summary : ${messagesAfterSummary} \n

        Latest message : ${userMessage} \n

        Format outputs using these rules:
        Currency: Always escape dollar signs with exactly one backslash (e.g. \\$50).
        Math/Variables: Use standard LaTeX wrapped in $ (inline) or $$ (block).
        CRITICAL BOUNDARY: Never place currency inside a LaTeX math block. Close the math block before writing currency amounts (e.g., write $R \\approx$ \\$3.4 billion, NOT $R \\approx \\$3.4$).
        These formatting rules should not affect the actual content explanation or examples.

        Based on the data provided, respond to the current user message.
        `
        console.log("Sending summary message");
        return {status: "Success", statusCode: 200, message: "Summary message created", summaryMessage : summaryMessage};
    } catch (error) {
        console.log(`Failed to create summary message : ${error.message} : ${error.stack}`);
        return {status: "Failed", statusCode: 500, message: "Failed to create summary message"};
    }
}