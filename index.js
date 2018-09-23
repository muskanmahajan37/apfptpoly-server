const express = require("express");
const request = require("request");
const scheduler = require("node-schedule");
const bodyParser = require("body-parser");
const fs = require("fs");
const mongoose = require("mongoose");

const VERIFY_KEY = process.env.VERIFY_KEY || "verifyKey";
const FILE_NAME = "students.json";

const app = express();
app.use(bodyParser.json());

// Connect to db
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost");
mongoose.Promise = global.Promise;
var db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => console.log("connected"));

// Create a schema
var studentSchema = new mongoose.Schema({
  username: String,
  cookies: Array
});

// Create a model
var Student = mongoose.model("Student", studentSchema);

// Read users from db
let students = [];
Student.find((err, result) => {
  if (err) return console.log(err);
  students = result;
});

// Create a scheduler which pinging to AP every 12 mins
var rule = new scheduler.RecurrenceRule();
rule.minute = [0, 12, 24, 36, 50];
scheduler.scheduleJob(rule, () => {
  console.log("running job...");

  students.forEach(student => {
    student.cookies.forEach(cookie => {
      const options = {
        url: "http://ap.poly.edu.vn/students/index.php",
        method: "GET",
        headers: {
          //Eg: "PHPSESSID=7lccdmkemmvvatchdobe92g001; campus_id=1; campus_name=FPT+Polytechnic+H%C3%A0+N%E1%BB%99i; campus_code=ph; db_config_file_name=ph.inc"
          Cookie: cookie
        }
      };

      request(options, (err, response) => {
        if (!err && response.statusCode === 200) {
          console.log("run job for user " + student.username);
        } else {
          console.log(err);
        }
      });
    });
  });
});

// Use uptimerobot to prevent server from stopping (heroku)
app.get("/", (req, res) => {
  res.send("ok");
});

// Add student cookies for pinging to AP every 12 mins
app.post("/auth", (req, res) => {
  const { username, cookies } = req.body;

  if (!username || !cookies) {
    return res.status(404).send("missing params");
  }

  const index = students.findIndex(student => student.username === username);

  let student = null;
  if (index === -1) {
    console.log("new student: " + username);
    student = new Student({ username, cookies: [] });
    students.push(student);
  } else {
    student = students[index];
  }

  student.cookies.push(cookies);
  student.save();

  res.send("ok");
});

var port = process.env.PORT || 1337;
var httpServer = require("http").createServer(app);
httpServer.listen(port, () => {
  console.log("AP running on port " + port + ".");
});
