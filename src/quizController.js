const { fetchTriviaQuestions } = require("./apiService");

// Controller function
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

const submitQuiz = (req, res) => {
    const userAnswers = [];
    const correctAnswers = [];
    const totalQuestions = Object.keys(req.body).length / 2; // Half of the inputs are user answers, half are correct answers

    for (let i = 0; i < totalQuestions; i++) {
        userAnswers.push(req.body[`answer${i}`]); // Extract user answers
        correctAnswers.push(req.body[`correctAnswer${i}`]); // Extract correct answers
    }

    // Calculate the score
    let score = 0;
    userAnswers.forEach((answer, index) => {
        if (answer === correctAnswers[index]) {
            score++;
        }
    });

    res.render("results", { score, totalQuestions }); // Render the results page
};

module.exports = { startQuiz, submitQuiz };
