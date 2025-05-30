import { default as mongoose, Schema } from 'mongoose';

const BoughtSchema = new Schema({
    mint: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    handle: {
        type: String,
        required: true
    }
});

export default mongoose.model("Bought", BoughtSchema);
