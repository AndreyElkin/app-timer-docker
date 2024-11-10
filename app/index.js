require("dotenv").config();
const express = require("express");
const url = require("url");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const nunjucks = require("nunjucks");
const { nanoid } = require("nanoid");
const { createHmac } = require("crypto");
const WebSocket = require("ws");
const http = require("http");
const cookie = require("cookie");

const app = express();

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
});

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");

app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());

const server = http.createServer(app);

const wss = new WebSocket.Server({ clientTracking: false, noServer: true });
const clients = new Map();

const findUserByUserName = async (username) => {
  return knex("users")
    .select()
    .where({ username })
    .limit(1)
    .then((results) => results[0]);
};

const findUserBySessionId = async (sessionId) => {
  const session = await knex("sessions")
    .select("user_id")
    .where({ session_id: sessionId })
    .limit(1)
    .then((result) => result[0]);

  if (!session) {
    return;
  }
  return await knex("users")
    .select()
    .where({ id: session.user_id })
    .limit(1)
    .then((result) => result[0]);
};

const createUser = async ({ username, password }) => {
  await knex("users").insert({
    username: username,
    password: createHmac("sha256", password).digest("hex"),
  });
};

const createSession = async (userId) => {
  const sessionId = nanoid();
  await knex("sessions").insert({
    user_id: userId,
    session_id: sessionId,
  });
  return sessionId;
};

const deleteSession = async (sessionId) => {
  await knex("sessions").where({ session_id: sessionId }).delete();
};

const createTimer = async (idTimer, userId, description) => {
  await knex("timers").insert({
    id: idTimer,
    user_id: userId,
    description: description,
    start: Date.now(),
    isActive: true,
  });
};

const findTimersByUserId = async (userId) => {
  return knex("timers").select().where({ user_id: userId });
};

const changeTimerNoActive = async (timerId) => {
  const timerById = await knex("timers")
    .select()
    .where({ id: timerId })
    .limit(1)
    .then((result) => result[0]);

  await knex("timers")
    .where({ id: timerId })
    .update({ isActive: false })
    .update({ end: Date.now() })
    .update({ duration: Date.now() - parseInt(timerById.start) });
  return timerById;
};

const auth = () => async (req, res, next) => {
  if (!req.cookies["sessionId"]) {
    return next();
  }
  req.user = await findUserBySessionId(req.cookies["sessionId"]);
  req.sessionId = req.cookies["sessionId"];
  next();
};

app.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user,
    session: req.cookies["sessionId"],
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

app.post("/login", bodyParser.urlencoded({ extend: false }), async (req, res) => {
  const { username, password } = req.body;
  const user = await findUserByUserName(username);
  const hashPassword = createHmac("sha256", password).digest("hex");
  if (!user || user.password !== hashPassword) {
    return res.redirect("/?authError=true");
  }
  const sessionId = await createSession(user.id);
  res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
});

app.get("/logout", auth(), async (req, res) => {
  if (!req.user) {
    return res.redirect("/");
  }
  await deleteSession(req.sessionId);
  res.clearCookie("sessionId").redirect("/");
});

app.post("/signup", bodyParser.urlencoded({ extend: false }), async (req, res) => {
  const { username, password } = req.body;
  await createUser({ username: username, password: password });
  const user = await findUserByUserName(username);
  const sessionId = await createSession(user.id);
  res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
});

app.post("/api/timers", auth(), async (req, res) => {
  const idTimer = nanoid();
  await createTimer(idTimer, req.user.id, req.body.description);
  res.json({ id: idTimer });
});

app.post("/api/timers/:id/stop", async (req, res) => {
  const timer = await changeTimerNoActive(req.params.id);
  res.json({ id: timer.id });
});

app.get("/api/timers", auth(), async (req, res) => {
  const timers = await findTimersByUserId(req.user.id);
  timers.forEach((timer) => {
    timer.end = parseInt(timer.end);
    timer.duration = parseInt(timer.duration);
    timer.start = parseInt(timer.start);
  });

  if (req.query.isActive === "true") {
    timers.forEach((timer) => {
      if (!timer.isActive) return;
      timer.progress = Date.now() - timer.start;
    });
    res.json(timers.filter((timer) => timer.isActive));
    return;
  }
  res.json(timers.filter((timer) => !timer.isActive));
});

server.on("upgrade", async (req, socket, head) => {
  const cookies = cookie.parse(req.headers["cookie"]);
  const sessionId = cookies["sessionId"];
  const getUser = await findUserBySessionId(sessionId);
  const userId = getUser.id;
  // eslint-disable-next-line node/no-deprecated-api
  const query = url.parse(req.url, true).query;
  const getSessionId = query.session_id;

  if (!userId && getSessionId !== sessionId) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }
  req.userId = userId;
  req.sessionId = sessionId;
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  const { userId } = req;
  clients.set(userId, ws);

  const timers = await findTimersByUserId(userId);
  ws.send(
    JSON.stringify({
      type: "all_timers",
      timers,
    })
  );

  ws.on("close", () => {
    clients.delete(userId);
  });
});

setInterval(async () => {
  for (const [userId, ws] of clients.entries()) {
    const activeTimers = await findTimersByUserId(userId);
    activeTimers.forEach((timer) => {
      timer.end = parseInt(timer.end);
      timer.duration = parseInt(timer.duration);
      timer.start = parseInt(timer.start);
    });
    const activeOnly = activeTimers.filter((timer) => timer.isActive);
    activeOnly.forEach((timer) => {
      timer.progress = Date.now() - timer.start;
    });
    ws.send(JSON.stringify({ type: "active_timers", timers: activeOnly }));
  }
}, 1000);

server.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on http://localhost:${process.env.PORT}`);
});
