const express = require("express"); // http framework
const bodyParser = require("body-parser"); // parsing http body
const cookieParser = require("cookie-parser"); // cookie work
const httpStatus = require("http-status"); // collection of http statuses
const mongoose = require("mongoose"); // work with mongodb
const cors = require("cors"); // чтобы работал дашборд, обработка cors policy

mongoose.connect("mongodb://188.166.50.246:27017/email-builder", {useNewUrlParser: true});

const UserModel = mongoose.model("Users", new mongoose.Schema({username: String, password: String}));
const EmailTemplateModel = mongoose.model("EmailTemplate", new mongoose.Schema({template: Object}));

// (async () => {
//   await UserModel.deleteMany();
//   await EmailTemplateModel.deleteMany();
//   await UserModel.create({username: "girl", password: "good"});
// })();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({credentials: true, origin: "http://localhost:5000"}));
app.use((req, res, next) => {
  console.log(`${new Date().toUTCString()} - ${req.url}`);
  next();
});

app.get("/templates", async (req, res) => {
  const templates = await EmailTemplateModel.find({});
  res.status(httpStatus.OK).send(templates);
});

app.get("/users", async (req, res) => {
  const users = await UserModel.find({});
  res.status(httpStatus.OK).send(users);
});

// auth token store
const tokens = new Map();
const AUTHENTICATED_TOKEN = "token";

const findUserByUsername = async (username) => {
  return UserModel.findOne({username});
};

app.post("/register", async (req, res) => {
  const {username} = req.body;

  if (await findUserByUsername(username))
    return res.status(httpStatus.CONFLICT).send();
  else
    await UserModel.create({username: req.body.username, password: req.body.password});

  res.status(httpStatus.OK).send();
});

app.post("/login", async (req, res) => {
  const {username, password} = req.body;
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const user = await findUserByUsername(username);

  if (user && user.password === password) {
    tokens.set(token, {date: new Date() + 1, username});
    res.cookie(AUTHENTICATED_TOKEN, token).send();
  } else
    res.status(httpStatus.FORBIDDEN).send();
});

// authenticate middleware
app.use(async (req, res, next) => {
  const token = req.cookies.token;
  if (tokens.has(token)) {
    const {date, username} = tokens.get(req.cookies.token);

    if (!date) return res.status(httpStatus.FORBIDDEN).send();
    else if (date - new Date() < 0) return res.status(httpStatus.FORBIDDEN).send();

    res.user = await findUserByUsername(username);
    return next();
  }

  res.status(httpStatus.FORBIDDEN).send();
});

app.post("/template", async (req, res) => {
  await EmailTemplateModel.create({
    template: req.body,
    username: res.user.username
  });

  res.status(httpStatus.OK).send();
});

app.get("/logout", (req, res) => res.clearCookie(AUTHENTICATED_TOKEN).send());

app.get("/me", (req, res) => res.status(httpStatus.OK).send({username: res.user.username}));

const port = 3002;
app.listen(port, () => console.log(`app listening on port ${port}`));
