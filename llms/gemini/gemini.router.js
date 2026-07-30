import express from 'express';
import { geminiModelCall } from './gemini.call.js';
const router = express.Router();

router.post('/call', async (req, res) => {
    try {
        const {model, message} = req.body;
        const result = await geminiModelCall(model, message);
        res.status(result.statusCode).json(result);
    } catch (error) {
        console.log(`Chat completion failed with gemini : ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed", message : error.message});
    }
});
export default router;