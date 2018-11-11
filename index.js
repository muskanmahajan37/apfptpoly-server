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
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ap");
mongoose.Promise = global.Promise;
const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => console.log("connected"));

// Create a schema
const studentSchema = new mongoose.Schema({
  username: String,
  cookie: String,
  cookies: Array
});

const crawl = async students => {
  try {
    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      student.cookie = student.cookies[student.cookies.length - 1];
      await student.save();
      console.log(`${i + 1}/${students.length}`);
    }
  } catch (err) {
    console.log(err);
  }
};

// Create a model
const Student = mongoose.model("Student", studentSchema);

// Read users from db
let students = [];
Student.find((err, result) => {
  if (err) return console.log(err);
  students = result;
  crawl(students);
});

// Create a scheduler which pinging to AP every 10 mins
const rule = new scheduler.RecurrenceRule();
rule.minute = [0, 10, 20, 30, 40, 50];
scheduler.scheduleJob(rule, () => {
  console.log("running job...");

  students.forEach(student => {
    if (student.cookie) {
      const options = {
        url: "http://ap.poly.edu.vn/students/index.php",
        method: "GET",
        headers: {
          Cookie: student.cookie
        }
      };

      request(options, (err, response) => {
        if (!err && response.statusCode === 200) {
          console.log(`run job for user ${student.username}`);
        } else {
          student.cookie = undefined;
          student.save();
        }
      });
    }
  });
});

// Use uptimerobot to prevent server from stopping (heroku)
app.get("/", (req, res) => {
  res.send("ok");
});

// Add student cookies for pinging to AP every 12 mins
app.post("/auth", (req, res) => {
  let { username, cookie, cookies } = req.body;

  // For old version
  if (cookies) {
    cookie = cookies;
  }

  if (!username || !cookie) {
    return res.status(404).send("missing params");
  }

  const index = students.findIndex(student => student.username === username);

  let student = null;
  if (index === -1) {
    console.log(`new student: ${username}`);
    student = new Student({ username, cookie });
    students.push(student);
  } else {
    student = students[index];

    // For old version
    if (cookies || !student.cookie) {
      student.cookie = cookie;
      student.save();
    } else {
      return res.send(student.cookie);
    }
  }
  res.send("ok");
});

const port = process.env.PORT || 3000;
const httpServer = require("http").createServer(app);

httpServer.listen(port, () => {
  console.log(`AP running on port ${port}`);
});
