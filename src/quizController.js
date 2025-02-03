const { fetchTriviaQuestions } = require("./apiService");
const { query } = require('./db');

const startQuiz = async (req, res) => {
    const { category, difficulty } = req.body;

    try {
        // Fetch questions from the API
        const questions = await fetchTriviaQuestions(10, category, difficulty);

        req.session.category = category;

        res.render("quiz", {
            questions,
            userID: req.session.userID || null,
            username: req.session.username || null
        });
    } catch (error) {
        // handle errors, render the index page with an error message
        res.render("index", {
            error: error.message,
            userID: req.session.userID || null,
            username: req.session.username || null
        });
    }
};

const submitQuiz = async (req, res) => {
    const userAnswers = [];
    const correctAnswers = [];
    const questions = [];
    const totalQuestions = Object.keys(req.body).length / 3; // 1/3 of the inputs are user answers, 1/3 are correct answers and 1/3 is the question text

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

    // Store answered questions in the database
    try {
        const category = req.session.category;
        // const questions = req.session.questions;
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const userAnswer = userAnswers[i];
            const isCorrect = userAnswer === correctAnswers[i];

            // check if the question has already been answered by the user
            const checkQuestionQuery = `
                SELECT AnswerID 
                FROM QuestionResults 
                WHERE UserID = ${req.session.userID} 
                AND Question = '${question.question.replace(/'/g, "''")}' 
                AND Category = '${category}'
            `;
            const result = await query(checkQuestionQuery);

            // if not, store it
            if (result.length === 0) {
                const insertQuery = `
                    INSERT INTO QuestionResults (
                                                 UserID, 
                                                 Category, 
                                                 Question, 
                                                 UserAnswer, 
                                                 CorrectAnswer, 
                                                 IsCorrect, 
                                                 AnsweredAt)
                    VALUES (
                            ${req.session.userID}, 
                            '${category}', 
                            '${question.question.replace(/'/g, "''")}', 
                            '${userAnswer.replace(/'/g, "''")}', 
                            '${correctAnswers[i].replace(/'/g, "''")}', 
                            ${isCorrect ? 1 : 0}, 
                            GETDATE())
                `;
                await query(insertQuery);
            }
        }

        res.render("results", {
            score,
            totalQuestions,
            questions,
            userID: req.session.userID || null,
            username: req.session.username || null
        });
    } catch (err) {
        console.error("Error saving results to database:", err);
        res.render("results", {
            score,
            totalQuestions,
            questions,
            userID: req.session.userID || null,
            username: req.session.username || null,
            error: "Failed to save results."
        });
    }
};

module.exports = { startQuiz, submitQuiz };
