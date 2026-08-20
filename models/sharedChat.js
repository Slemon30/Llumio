import mongoose, { Mongoose } from "mongoose";
const {Schema, model} = mongoose;

const sharedChatSchema = new Schema({
    chatId : {type: mongoose.Schema.Types.ObjectId, required: true},
    ownerUserId : {type: mongoose.Schema.Types.ObjectId, required: true},
    chatCode : {type: String, required: true, unique: true, index: true},
}, {timestamps: true});

export default model('sharedChat', sharedChatSchema);