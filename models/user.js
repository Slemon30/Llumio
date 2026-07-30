import mongoose from "mongoose";
const { Schema, model } = mongoose;

const userSchema = new Schema({
    username : {type: String, required: true},
    emailId : {type: String, required: true, unique: true},
    password: {type: String, required: true},
    balance: {type: Number, default: 1000000, get : (v) => parseFloat(v.toString()), required: true},
}, {toJSON : {getters: true } });

export default model('user', userSchema);