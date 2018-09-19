const express = require("express");
const request = require("request");
const scheduler = require("node-schedule");
const bodyParser = require("body-parser");
const fs = require("fs");

const VERIFY_KEY = process.env.VERIFY_KEY || "verifyKey";
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

// Create a scheduler which pinging to AP every 12 mins
var rule = new scheduler.RecurrenceRule();
rule.minute = [0, 12, 24, 36, 48];
scheduler.scheduleJob(rule, () => {
  console.log("running job...");

  Object.keys(students).forEach(username => {
    students[username].forEach(cookie => {
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
          console.log("run job for user " + username);
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

  if (!students[username]) {
    console.log("new student: " + username);
    students[username] = [];
  }

  students[username].push(cookies);
  fs.writeFileSync(FILE_NAME, JSON.stringify(students), "utf8");
  res.send("ok");
});

app.post("/remove_user", (req, res) => {
  const { username, key } = req.body;

  if (!username || !key) {
    return res.status(404).send("missing params");
  }

  if (key !== VERIFY_KEY) {
    return res.status(407).send("auth failed");
  }

  delete students[username];

  fs.writeFileSync(FILE_NAME, JSON.stringify(students), "utf8");
  res.send("ok");
});

// Get all users (backup only)
app.post("/users", (req, res) => {
  const { key } = req.body;

  if (!key || key !== VERIFY_KEY) {
    return res.status(407).send("auth failed");
  }

  return res.send(JSON.stringify(students));
});

// Update data (for reset or restore backed up data)
app.put("/users", (req, res) => {
  const { key, users } = req.body;

  if (!key || key !== VERIFY_KEY) {
    return res.status(407).send("auth failed");
  }

  students = users;

  fs.writeFileSync(FILE_NAME, JSON.stringify(students), "utf8");

  return res.send("ok");
});

var port = process.env.PORT || 1337;
var httpServer = require("http").createServer(app);
httpServer.listen(port, () => {
  console.log("AP running on port " + port + ".");
});
