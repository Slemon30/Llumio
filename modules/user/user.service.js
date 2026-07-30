import user from '../../models/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function userSignup(username, emailId, password) {
    const oldUser = await user.findOne({emailId: emailId});

    if (oldUser) {
        return {status: "Failed", statusCode: 409, message: "User already exists"};
    }

    const newUser = await user.create({
        username,
        emailId,
        password,
    });

    if(!newUser) {
        return {status: "Failed", statusCode: 500, message: "Failed to create new User"};
    }

    return {status: "Success" , statusCode: 201, message: "User signed up successfully"};
}

export async function userLogin(emailId, password) {
    const User = await user.findOne({emailId : emailId});

    if (!User) {
        return { status: "Failed", statusCode: 404, message: "User not Found" };
    }

    const validPassword = await bcrypt.compare(password, User.password);
    if (!validPassword) {
        return { status: "Failed", statusCode: 401, message: "Incorrect password"};
    }

    const token = jwt.sign({id : User._id}, process.env.JWT_TOKEN, { expiresIn: "1d"});
    return {status: "Success", statusCode: 200, message : "User Login Successful", accessToken : token};
}

export async function userProfile(userId) {
    const userDetails = await user.findById(userId);
    if (!userDetails) {
        return {status : "Failed", statusCode: 404, message : "User not found"};
    }
    return {status : "Success",
         statusCode: 200,
         message : "User found successfully",
         username: userDetails.username, 
         emailId: userDetails.emailId, 
         walletBalance: userDetails.balance
        };
}

export async function userWalletBalance(userId) {
    const userDetails = await user.findById(userId);
    if (!userDetails) {
        return {status : "Failed", statusCode: 404, message : "User not found"};
    }

    return {status: "Success", 
        statusCode: 200, 
        walletBalance : userDetails.balance, 
        message: "User wallet balance details found successfully"
    };
}

export async function updateBalance(userId, amount, type) {
    let userDetails;
    if (type === "sub") {
        userDetails = await user.findByIdAndUpdate(userId, {$inc : { balance : -amount } }, {returnDocument: 'after'});
    }
    if (type === "add") {
        userDetails = await user.findByIdAndUpdate(userId, {$inc : { balance : +amount } }, {returnDocument: 'after'});    
    }
    if (!userDetails) {
        return {status : "Failed", statusCode: 404, message : "User not found"};
    }
    return {status: "Success", 
        statusCode: 200, 
        walletBalance : userDetails.balance, 
        message: "User wallet balance details found successfully"
    }; 
}