import { default as mongoose, Schema } from 'mongoose';

const TokenSchema = new Schema({
    mint: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '4h'
    },
    name: {
        type: String,
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    handle: {
        type: String,
        required: true
    },
    uri: {
        type: String,
        required: true
    },
    vault: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
    launched: {
        type: Boolean,
        required: true,
        default: false
    }
});

export default mongoose.model("Token", TokenSchema);
