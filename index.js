const express = require("express");
const path = require("path");
const request = require("request");
const scheduler = require("node-schedule");
const bodyParser = require("body-parser");
const fs = require("fs");

const FILE_NAME = "students.json";

const app = express();
app.use(bodyParser.json());

// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "/public/index.html"));
// });

// Read users from file (or create if not exists)
let students = {};
if (fs.existsSync(FILE_NAME)) {
  const content = fs.readFileSync(FILE_NAME, "utf8");
  students = JSON.parse(content);
} else {
  fs.writeFileSync(FILE_NAME, "{}", { flag: "wx" });
}

// Create a scheduler which pinging to AP every 20 mins
var rule = new scheduler.RecurrenceRule();
rule.minute = [0, 20, 40];
scheduler.scheduleJob(rule, () => {
  console.log("running job...");

  Object.keys(students).map(username => {
    const options = {
      url: "http://ap.poly.edu.vn/students/index.php",
      method: "GET",
      headers: {
        //Eg: "PHPSESSID=7lccdmkemmvvatchdobe92g001; campus_id=1; campus_name=FPT+Polytechnic+H%C3%A0+N%E1%BB%99i; campus_code=ph; db_config_file_name=ph.inc"
        Cookie: students[username]
      }
    };

    request(options, (err, response, body) => {
      if (!err && response.statusCode === 200) {
        console.log("==============================");
        console.log("run job for user " + username);
        console.log("===============================");
        console.log(body);
      } else {
        console.log(err);
      }
    });
  });
});

app.post("/auth", (req, res) => {
  const { username, cookies } = req.body;

  if (!username || !cookies) {
    return res.status(404).send("missing params");
  }

  console.log("new student: " + username);
  students[username] = cookies;
  fs.writeFileSync(FILE_NAME, JSON.stringify(students), "utf8");
  res.send("ok");
});

var port = process.env.PORT || 1337;
var httpServer = require("http").createServer(app);
httpServer.listen(port, () => {
  console.log("Ap running on port " + port + ".");
});
