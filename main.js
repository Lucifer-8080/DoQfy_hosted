const express = require("express");
const fileUpload = require("express-fileupload");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const mongoose = require('mongoose');
const mammoth = require('mammoth');
require('dotenv').config();
const path = require('path');
const Question = require('./Questions');
const Topics = require('./Topics');
const fs = require('fs');
const cors = require('cors');
let count = 0

const app = express();
const connectToMongoDB = async () => {
  mongoose
    .connect('mongodb+srv://om:omiii@atlascluster.zo09joq.mongodb.net/Quiz?retryWrites=true&w=majority')
    .then(() => console.log('MongoDB connected ok'))
    .catch((err) => console.error(err));
}
connectToMongoDB();

app.use(cors());
app.use(express.static(path.join(__dirname, 'build')));
// app.use("/", express.static("dist"));
app.use(fileUpload());


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
})


app.post("/extract", async (req, res) => {
  try {
    // if (!req.files && !req.forms) {
    //   res.status(400).json({ error: 'No file uploaded' });
    //   return;
    // }

    const topic = req.body.topic;
    const numMcqs = parseInt(req.body.numMcqs) || 10;
    count = numMcqs;
    const tempText = req.body.txt? req.body.txt: null;

    console.log(numMcqs);
    console.log(topic);
    console.log(tempText);


    let text = "";

    if (req.files?.pdfFile) {
      // Extract text from PDF file
      const pdfText = await pdfParse(req.files.pdfFile);
      text = pdfText.text;
      // console.log(text);

    } else if (req.files?.docxFile) {
      // Extract text from DOCX file
      const docxText = await mammoth.extractRawText({ buffer: req.files.docxFile.data });
      text = docxText.value;
    }else if (req.files?.txtFile) {
      // Extract text from DOCX file
      text = fs.readFileSync(req.files.txtFile.data, 'utf8');
    }else if (tempText) {
      // Extract text from DOCX file
      text = tempText;
      // console.log(text);
    }




    const cleanedText = text.replace(/\s+/g, ' ').trim();

    let word = cleanedText.split(/\s+/);
    let wordCount = word.length;



if (wordCount > 6500) {
 word = word.slice(0, 6500);
    wordCount = 6500;
  
  }else if(wordCount < 20){
  return res.status(400).json({ error: 'Text too short' });
}

    //save cleandedText to txt file
    // fs.writeFileSync('demo.txt', cleanedText);

    // console.log(cleanedText);
    // console.log(cleanedText.length);

// Join the words back into a single string
const truncatedText = word.join(' ');

// Assuming 100 tokens equal 70 words
const tokensToWordsRatio = 100 / 70;

// Calculate the number of tokens based on the word count
const tokensCount = Math.ceil(wordCount / tokensToWordsRatio);
console.log("Word Count:" +wordCount);
console.log(" Tokens:" +tokensCount);
// console.log(" Truncated Text:" +truncatedText);


    let topic1 = null;
    try {
      topic1 = await Topics.create({ topic: topic });
    } catch (error) {
      console.error(error);
      res.send("Topic already exists");
    }


    let generatedQuestions = 0;
    let totalQuestions = 0;
    do {
      generatedQuestions = await getMcqs(truncatedText, topic1.topic);
      totalQuestions += generatedQuestions;
      console.log(generatedQuestions);
    } while (totalQuestions < numMcqs);



    const topicWiseQuestions = await Topics.findOne({ topic: topic1.topic })
      .populate({
        path: 'mcqs',
        model: 'Question', // Replace 'Question' with the actual model name for questions
        select: 'question options -_id', // Adjust the fields you want to include
        options: { lean: true }, // Set the lean option to true

      })
      .select('topic mcqs -_id'); // Adjust the fields you need

    let mcqs = topicWiseQuestions.mcqs;
  
    console.log(mcqs.length);
    const topicTitle = `${topic1.topic}`;

    console.log(topicTitle, mcqs);
    console.log("Done !");

    res.json({ topicTitle: topicTitle, mcqs: mcqs });


  } catch (error) {
    console.error(error);
    res.send("Topic already exists");
  }
});


app.get('/getmcqonline/:topic/:count', async (req, res) => {
  try {
    const { topic, count } = req.params;
    console.log(count);
    console.log(topic);

    const findTopic = await Topics.findOne({ topic }).populate({
      path: 'mcqs',
      select: 'question options -_id',
    });

    console.log(findTopic);

if (!findTopic) { 
  return res.status(404).json({ message: 'Topic not found.' });
}
 // Selecting 10 random MCQs from the populated 'mcqs' field
 
// const selectedMCQs = findTopic.mcqs;

if (count >= findTopic.mcqs.length) {
    res.json(findTopic.mcqs);

}
else if (count === "0") {
    const selectedMCQs = [];
    const availableIndexes = Array.from(Array(findTopic.mcqs.length).keys());
    for (let i = 1; i <= 1; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndexes.length);
      const index = availableIndexes[randomIndex];
      selectedMCQs.push(findTopic.mcqs[index]);
      availableIndexes.splice(randomIndex, 1);
     }

     res.json(selectedMCQs);

    }else{

        const selectedMCQs = [];
        const availableIndexes = Array.from(Array(findTopic.mcqs.length).keys());
        for (let i = 1; i <= count; i++) {
          const randomIndex = Math.floor(Math.random() * availableIndexes.length);
          const index = availableIndexes[randomIndex];
          selectedMCQs.push(findTopic.mcqs[index]);
          availableIndexes.splice(randomIndex, 1);
         }
    
         res.json(selectedMCQs);      
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/availabletopics', async (req, res) => {
  const topics = await Topics.find();
  console.log("topics");
  //calculate available number of mcqs in each topic
  const topicsWithCount = await Promise.all(topics.map(async topic => {
    const count = await Question.countDocuments({_id: {$in: topic.mcqs}});
    return {topic: topic.topic, count};
  }));
  console.log(topicsWithCount);
  res.json(topicsWithCount);
});

const saveToDatabase = async (final, topic) => {

  try {
    if (final) {

      const questions = await Question.insertMany(final);
      console.log(questions.length + ' Data saved to the database successfully!');
      // Extract question IDs
      const questionIds = questions.map(question => question._id);

      // Update the Topics collection with question IDs
      await Topics.updateMany({ topic: topic }, { $addToSet: { mcqs: { $each: questionIds } } });

      return questions.length;
    }
    else {
      console.log('No data to save to the database.');
    }
  } catch (error) {
    console.error('Error saving data to the database:', error);

  } finally {
    // Disconnect from the database
    // mongoose.disconnect();
  }

};



const getMcqs = async (text, topic) => {
  // Explicitly instruct the model to generate multiple-choice questions

  const prompt = `Generate a set of 20 MCQs (objective and factual, avoid subjective interpretation and avoid limited context) from the following text in format like JSON: {
      "questions": [
        {
          "question": "",
          "options": [{"text":" ",isCorrect:boolean}, {"text":" ","isCorrect":boolean}, {"text":" ","isCorrect":boolean}, {"text":" ","isCorrect":boolean}]
        }
      ]
    } \n${text}`;

  // const prompt = `Generate/extract a set of diverse true/false MCQs from the following text in format like: [{"question": "Question here...", "options": ["Option1", "Option2"], "answer": "Correct Option here."}]\n${text}`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-16k",
    user: "user-1234",
    messages: [
      {
        "role": "user",
        "content": prompt,
      },
    ],
    temperature: 1,
    max_tokens: 4096,
    top_p: 1,

  });
console.log(response.choices[0].message.content);
  const generatedQuestions = JSON.parse(response.choices[0].message.content);

  console.log(generatedQuestions);
  for (let mcq of generatedQuestions.questions) {
    console.log("Question:", mcq.question);
    console.log("Options:");
    for (const option of mcq.options) {
      console.log(" -", option);
    }
    console.log(); // Add an empty line for readability
  }

  return await saveToDatabase(generatedQuestions.questions, topic);
  // return generatedQuestions.questions.length;
}
const PORT = process.env.PORT || 5100;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});