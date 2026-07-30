import mongoose, { Mongoose } from "mongoose";
const {Schema, model} = mongoose;

const chatSchema = new Schema({
    userId : {type: mongoose.Schema.Types.ObjectId, required: true},
    originalModel : {type: String, required: true},
    originalProvider: {type: String, required: true},
    latestModel : {type: String, required: true},
    latestProvider : {type: String, required: true},
    messages : [
        {
            sender : {type: String, required: true, enum: ["USER", "LLM"]},
            message : {type: String, required: true},
            timestamp : {type: Date, default: Date.now()},
        }
    ],
    interactionId : {type: String},
}, {timestamps: true});

export default model('chat', chatSchema);