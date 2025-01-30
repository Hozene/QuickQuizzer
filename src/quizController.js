const { fetchTriviaQuestions } = require("./apiService");
const { query } = require('./db');

const startQuiz = async (req, res) => {
    const { category, difficulty } = req.body;

    try {
        // Fetch questions from the API
        const questions = await fetchTriviaQuestions(10, category, difficulty);

        res.render("quiz", { questions });
    } catch (error) {
        // handle errors, render the index page with an error message
        res.render("index", { error: error.message });
    }
};

const submitQuiz = async (req, res) => {
    const userAnswers = [];
    const correctAnswers = [];
    const questions = [];
    const totalQuestions = Object.keys(req.body).length / 3; // Half of the inputs are user answers, half are correct answers

    for (let i = 0; i < totalQuestions; i++) {
        userAnswers.push(req.body[`answer${i}`]); // Extract user answers
        correctAnswers.push(req.body[`correctAnswer${i}`]); // Extract correct answers
        questions.push({
            question: req.body[`question${i}`], // add question text
            userAnswer: req.body[`answer${i}`],
            correctAnswer: req.body[`correctAnswer${i}`],
        });
    }

    // Calculate the score
    let score = 0;
    userAnswers.forEach((answer, index) => {
        if (answer === correctAnswers[index]) {
            score++;
        }
    });

    try {
        const userID = req.session.userID;
        const category = req.session.quizCategory;

        for (let i = 0; i < questions.length; i++) {
            const { question, userAnswer, correctAnswer } = questions[i];
            const isCorrect = userAnswer === correctAnswer ? 1 : 0;

            const sqlQuery = `
                INSERT INTO QuestionResults (UserID, Category, Question, UserAnswer, CorrectAnswer, IsCorrect, AnsweredAt)
                VALUES (${userID}, '${category}', '${question.replace(/'/g, "''")}', '${userAnswer.replace(/'/g, "''")}', '${correctAnswer.replace(/'/g, "''")}', ${isCorrect}, GETDATE())
            `;
            await query(sqlQuery);
        }

        res.render("results", { score, totalQuestions, questions });
    } catch (err) {
        console.error("Error saving results to database:", err);
        res.render("results", { score, totalQuestions, questions, error: "Failed to save results." });
    }
};

module.exports = { startQuiz, submitQuiz };
