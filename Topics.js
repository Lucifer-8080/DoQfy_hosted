const mongoose = require('mongoose');
const Question = require('./Questions');

const topicSchema = new mongoose.Schema({
    topic: {type: String},
    mcqs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], // Reference to questions
    description: String
}, {
    versionKey: false, // Disable the "__v" field
});
  

const Topic = mongoose.model('Topic', topicSchema);

module.exports = Topic;