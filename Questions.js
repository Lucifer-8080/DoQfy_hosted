// model.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    text: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }]
},
{
  versionKey: false, // Disable the "__v" field
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
