require("dotenv").config();
const express = require("express");
const path = require("path");
const { startQuiz } = require("./src/quizController");
const quizController = require("./src/quizController");

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// routes
app.get("/", (req, res) => {
    res.render("index", { error: null }); // home screen
});

app.post("/quiz", startQuiz); // quiz controller

app.post("/results", quizController.submitQuiz);

// start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
