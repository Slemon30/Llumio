import express from 'express';
import verifyToken from '../../middleware/auth.js';
import { createSharedChat, getSharedChat } from './sharedChat.service.js';
const router = express();

router.post('/create', verifyToken, async(req, res) => {
    try {
        console.log(req.body);
        const {chatId} = req.body;
        const userId = req.user.id;
        console.log(userId);
        const sharedCode = await createSharedChat(chatId, userId);
        res.status(sharedCode.statusCode).json(sharedCode);
    } catch (error) {
        console.log(`Failed to create sharing token for chat: ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed", statusCode : 500, message: error.message});
    }
});

router.get("/:id", async(req, res) => {
    try {
        const sharedChatCode = req.params.id;
        const chat = await getSharedChat(sharedChatCode); 
        res.status(chat.statusCode).json(chat);
    } catch (error) {
        console.log(`Failed to retrieve shared chat : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed", statusCode: 500, message : error.message});
    }
});

export default router;