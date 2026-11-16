const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const COOLDOWN_MS = 30 * 60 * 1000;

const QUIZZES = {
  huib: {
    title: "Team Huib",
    questions: [
      { title: "Wonen in het buitenland", text: "In welk land naast Nederland heeft Huib vroeger gewoond?", options: ["België", "Duitsland", "Frankrijk", "Luxemburg"], correct: 2, fact: "Huib woonde daar van zijn 1e tot zijn 7e." },
      { title: "De LP naast de tv", text: "Van welke artiest heeft Huib een LP naast zijn tv staan?", options: ["Drake", "Lange Frans", "J. Cole", "André Hazes Jr."], correct: 2, fact: "Huib heeft de plaat maar één keer beluisterd. 😂" },
      { title: "Favoriete eten", text: "Als Huib de rest van zijn leven nog maar één gerecht zou mogen eten, wat zou hij kiezen?", options: ["Pizza", "Pasta", "Sushi", "Steak"], correct: 1, fact: "Pasta is het enige gerecht dat Huib zelf maakt. 😂" },
      { title: "Eerste auto", text: "Wat was de eerste auto van Huib?", options: ["Opel Corsa", "Suzuki Swift", "Peugeot 106", "Ford Fiesta"], correct: 2, fact: "Het blauwe gevaarte! 🚙😂" },
      { title: "De hersenkraker 🧠", text: "Een vijver is bedekt met waterlelies. Iedere dag verdubbelt het aantal waterlelies. Na 48 dagen is de vijver helemaal bedekt. Op welke dag was de vijver voor de helft bedekt?", options: ["Dag 24", "Dag 36", "Dag 40", "Dag 47"], correct: 3 },
      { title: "Gameverslaving 🎮", text: "Welk spel heeft Huib het meest gespeeld?", options: ["Call of Duty: Warzone", "Rocket League", "Battlefield 5", "Fortnite"], correct: 1, fact: "Huib heeft er ongeveer 4000 uur in zitten en bakt er nog steeds niks van. 😂" }
    ],
    prediction: { title: "De grote voorspelling 💗", text: "Wat denken jullie dat Huib en Naomy verwachten?", options: ["Een jongen 💙", "Een meisje 💗"] }
  },
  naomy: {
    title: "Team Naomy",
    questions: [
      { title: "Ambitie", text: "Wat wilde Naomy vroeger worden?", options: ["Dokter", "Actrice", "Dierenarts", "Lerares"], correct: 2, fact: "Naomy was en is gek op dieren en wilde ze graag helpen als ze ziek waren." },
      { title: "Jonge jaren", text: "Hoe heet de knuffel die Naomy als baby al had?", options: ["Nijltje", "Nijntje", "Pippi", "Pluis"], correct: 0, fact: "Nijltje kreeg Naomy toen ze baby was en deze heeft ze nog steeds. Al heeft die al menig operatie ondergaan en kijkt hij een beetje scheel." },
      { title: "Vakantie", text: "Waar is Naomy nog nooit geweest?", options: ["Frankrijk", "Italië", "Spanje", "Turkije"], correct: 2, fact: "Als kind ging Naomy altijd naar Frankrijk. Met pap en mam ook nog naar Turkije geweest. Later nog een keer in Italië beland. Spanje heeft ze echter nog niet bezocht." },
      { title: "Disney fan", text: "Wat is Naomy's favoriete Disneyfilm?", options: ["Lion King", "Brother Bear", "Winnie the Pooh", "Tangled"], correct: 1, fact: "Brother Bear is de favoriete film. Deze laat heel mooi de relatie zien tussen de broers en de verzorgende rol die Kenai op zich neemt." },
      { title: "Eten :p", text: "Wat lust Naomy niet?", options: ["Spruitjes", "Champignons", "Andijvie", "Paprika"], correct: 3, fact: "Naomy heeft paprika nooit lekker gevonden. Spruitjes en champignons heeft ze leren eten. Andijvie was een van haar favoriete babyvoedsel in potjes." }
    ],
    prediction: { title: "De grote voorspelling 💗", text: "Wat denken jullie dat Huib en Naomy verwachten?", options: ["Een jongen 💙", "Een meisje 💗"] }
  }
};

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { sessions: {} }; }
}
let db = loadData();
function saveData() {
  const temp = DATA_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DATA_FILE);
}
function cookieSession(req, res) {
  const cookies = Object.fromEntries((req.headers.cookie || "").split(";").map(v => v.trim().split("=")).filter(v => v.length === 2));
  let id = cookies.babyquiz;
  if (!id || !/^[a-f0-9]{48}$/.test(id)) {
    id = crypto.randomBytes(24).toString("hex");
    const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `babyquiz=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure}`);
  }
  if (!db.sessions[id]) db.sessions[id] = {};
  return id;
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 10000) reject(new Error("Body too large")); });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
const server = http.createServer(async (req, res) => {
  const sessionId = cookieSession(req, res);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/state" && req.method === "GET") {
    const team = url.searchParams.get("team") || "huib";
    const quiz = QUIZZES[team];
    if (!quiz) return send(res, 404, { error: "Team niet gevonden" });
    if (quiz.comingSoon) return send(res, 200, { comingSoon: true, title: quiz.title });
    const state = db.sessions[sessionId][team] || { index: 0, cooldownUntil: 0, prediction: null, complete: false };
    if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
      db.sessions[sessionId][team] = { index: 0, cooldownUntil: 0, prediction: null, complete: false };
      saveData();
    }
    const current = db.sessions[sessionId][team] || { index: 0, cooldownUntil: 0, prediction: null, complete: false };
    return send(res, 200, {
      title: quiz.title, total: quiz.questions.length, index: current.index,
      cooldownUntil: current.cooldownUntil, complete: current.complete, prediction: current.prediction,
      question: current.index < quiz.questions.length ? { ...quiz.questions[current.index], correct: undefined } : null,
      predictionQuestion: quiz.prediction
    });
  }

  if (url.pathname === "/api/answer" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const { team, answer } = body;
      const quiz = QUIZZES[team];
      if (!quiz || quiz.comingSoon) return send(res, 400, { error: "Deze quiz is nog niet beschikbaar." });
      const state = db.sessions[sessionId][team] || { index: 0, cooldownUntil: 0, prediction: null, complete: false };
      if (state.cooldownUntil > Date.now()) return send(res, 429, { error: "Je moet nog even wachten.", cooldownUntil: state.cooldownUntil });
      if (state.cooldownUntil && Date.now() >= state.cooldownUntil) Object.assign(state, { index: 0, cooldownUntil: 0, prediction: null, complete: false });
      if (state.index >= quiz.questions.length) return send(res, 400, { error: "Je hebt alle quizvragen al beantwoord." });
      const question = quiz.questions[state.index];
      if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) return send(res, 400, { error: "Ongeldig antwoord." });
      if (answer !== question.correct) {
        state.index = 0; state.prediction = null; state.complete = false;
        state.cooldownUntil = Date.now() + COOLDOWN_MS;
        db.sessions[sessionId][team] = state; saveData();
        return send(res, 200, { correct: false, cooldownUntil: state.cooldownUntil, message: "Helaas, fout antwoord! Je kunt over 30 minuten opnieuw beginnen." });
      }
      state.index += 1; db.sessions[sessionId][team] = state; saveData();
      return send(res, 200, { correct: true, finishedQuestions: state.index, total: quiz.questions.length, fact: question.fact || null });
    } catch { return send(res, 400, { error: "Kon je antwoord niet verwerken." }); }
  }

  if (url.pathname === "/api/prediction" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const { team, answer } = body;
      const quiz = QUIZZES[team];
      if (!quiz || quiz.comingSoon) return send(res, 400, { error: "Deze quiz is nog niet beschikbaar." });
      const state = db.sessions[sessionId][team] || { index: 0, cooldownUntil: 0, prediction: null, complete: false };
      if (state.cooldownUntil > Date.now()) return send(res, 429, { error: "Je moet nog even wachten.", cooldownUntil: state.cooldownUntil });
      if (state.index < quiz.questions.length) return send(res, 400, { error: "Beantwoord eerst alle quizvragen." });
      if (answer !== 0 && answer !== 1) return send(res, 400, { error: "Kies jongen of meisje." });
      state.prediction = answer; state.complete = true; db.sessions[sessionId][team] = state; saveData();
      return send(res, 200, { success: true, message: "Je voorspelling is opgeslagen!" });
    } catch { return send(res, 400, { error: "Kon je voorspelling niet opslaan." }); }
  }

  if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "Niet gevonden" });
  const requested = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  const file = path.resolve(PUBLIC_DIR, requested);
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== path.join(PUBLIC_DIR, "index.html")) return send(res, 403, { error: "Verboden" });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: "Bestand niet gevonden" });
    const ext = path.extname(file);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" }); res.end(data);
  });
});
server.listen(PORT, () => console.log(`Babyquiz draait op http://localhost:${PORT}`));
function shutdown() { server.close(() => process.exit(0)); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
