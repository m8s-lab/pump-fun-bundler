import { default as mongoose, Schema } from 'mongoose';

const AmmBoughtSchema = new Schema({
    mint: {
        type: String,
        required: true
    },
    pool: {
        type: String,
        required: true
    },
    creator: {
        type: String,
        required: true
    },
    solReserve: {
        type: String,
        required: true
    },
    tokenReserve: {
        type: String,
        required: true
    },
    buyAt: {
        type: Date,
        default: Date.now,
    }
});

export default mongoose.model("AmmBought", AmmBoughtSchema);
