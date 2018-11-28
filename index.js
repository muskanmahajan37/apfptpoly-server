const express = require("express");
const request = require("./request-services");
const scheduler = require("node-schedule");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

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
  cookie: String
});

// Create a model
const Student = mongoose.model("Student", studentSchema);

// Read users from db
let students = [];
Student.find((err, result) => {
  if (err) return console.log(err);
  students = result;
});

// Create a scheduler which pinging to AP every 10 mins
const rule = new scheduler.RecurrenceRule();
rule.minute = [0, 12, 24, 36, 48];
scheduler.scheduleJob(rule, async () => {
  console.log("running job...");

  for (const student of students) {
    if (student.cookie) {
      try {
        const { response, data } = await request({
          url: "http://ap.poly.edu.vn/students/index.php",
          method: "GET",
          headers: {
            Cookie: student.cookie
          }
        });

        if (response.statusCode === 200 && data) {
          console.log(`job ran for user ${student.username}`);
        } else {
          student.cookie = undefined;
          await student.save();
        }
      } catch (err) {
        student.cookie = undefined;
        await student.save();
      }
    }
  }
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
    student.save();
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
