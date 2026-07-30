import express from 'express';
import bcrypt from 'bcrypt';
import { userSignup, userLogin, userProfile, userWalletBalance } from './user.service.js';
import verifyToken from '../../middleware/auth.js';
const router = express();

router.post('/signup', async(req, res) => {
    try {
        const { username, emailId, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await userSignup(username, emailId, hashedPassword);
        res.status(newUser.statusCode).json(newUser);
    } catch (error) {
        console.log(`User signup failed : ${error.message} : ${error.stack}`);
        res.status(500).json({ status: "Failed", message: error.message });
    }
});

router.post('/login', async(req, res) => {
    try {
        const { emailId, password } = req.body;
        const checkLogin = await userLogin(emailId, password);
        res.status(checkLogin.statusCode).json(checkLogin);
    } catch (error) {
        console.log(`User login failed : ${error.message} : ${error.stack}`);
        res.status(500).json({ status: "Failed", message: error.message });
    }
});

router.get('/profile/:id', verifyToken, async(req, res) => {
    try {
        const id = req.query.id;
        const userDetails = await userProfile(id);
        res.status(userDetails.statusCode).json(userDetails);
    } catch (error) {
        console.log(`Failed to fetch user profile: ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed" , message : error.message});
    }
});

router.get('/balance', verifyToken, async(req, res) => {
    try {   
        const userId = req.user.id;
        const walletBalance = await userWalletBalance(userId);
        res.status(walletBalance.statusCode).json(walletBalance);
    } catch (error) {
        console.log(`Failed to fetch wallet balance: ${error.message} : ${error.stack}`);
        res.status(500).json({status: "Failed", message : error.message});
    }
});

export default router;