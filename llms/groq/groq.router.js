import express from 'express';
import { groqModelCall } from './groq.call.js';
const router = express.Router();

router.post('/call', async (req, res) => {
    try {
        const {model, message} = req.body;
        const result = await groqModelCall(model, message);
        res.status(result.statusCode).json(result);
    } catch (error) {
        console.log(`Chat completion failed with groq : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed", message : error.message});
    }
});

export default router;