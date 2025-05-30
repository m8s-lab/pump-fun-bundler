import { default as mongoose, Schema } from 'mongoose';

const BlacklistSchema = new Schema({
    handle: {
        type: String,
        required: true
    }
});

export default mongoose.model("Blacklist", BlacklistSchema);
