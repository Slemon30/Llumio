import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

import geminiRoute from './llms/gemini/gemini.router.js';
import groqRoute from './llms/groq/groq.router.js';
import userRoute from './modules/user/user.routes.js';
import chatRoute from './modules/chat/chat.routes.js';

app.use('/gemini', geminiRoute);
app.use('/groq', groqRoute);
app.use('/user', userRoute);
app.use('/chat', chatRoute);

try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to MongoDB`);
} catch (error) {
    console.error(`Failed to connect to MongoDB : ${error.message} : ${error.stack}`);
}

app.listen(process.env.APP_PORT, () => {
    console.log(`App listening on port ${process.env.APP_PORT}`);
});