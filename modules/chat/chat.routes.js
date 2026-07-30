import express from 'express';
import { newChat, completeChat, getAllChats, getChat } from './chat.services.js';
import verifyToken from '../../middleware/auth.js';
const router = express();

router.post('/newchat', verifyToken, async(req, res) => {
    try {
        const {model, provider, message} = req.body;
        const userId = req.user.id;
        const reply = await newChat(userId, model, provider, message);
        res.status(reply.statusCode).json(reply);
    } catch (error) {
        console.log(`Failed to create new chat : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed" ,  message : error.message});
    }
});

router.post('/chat', verifyToken, async(req, res) => {
    try {
        const {chatId, model, provider, message} = req.body;
        const userId = req.user.id;
        const reply = await completeChat(chatId, userId, model, provider, message);
        res.status(reply.statusCode).json(reply);
    } catch (error) {
        console.log(`Failed to complete chat : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed" ,  message : error.message});
    }
});

router.get('/allchats', verifyToken, async(req, res) => {
    try {
        const id = req.user.id;
        const allChats = await getAllChats(id);
        res.status(allChats.statusCode).json(allChats);
    } catch (error) {
        console.log(`Failed to retrieve user's chats : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed" ,  message : error.message});
    }
})

router.get('/:chatId', verifyToken, async(req, res) => {
    try {
        const chatId = req.params.chatId;
        console.log(chatId);
        const selectedChat = await getChat(chatId);
        res.status(selectedChat.statusCode).json(selectedChat);
    } catch (error) {
        console.log(`Failed to retrieve chat details : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed" ,  message : error.message});
    }
})

export default router;