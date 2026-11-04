// Fetches a player's stats from the Geometry Dash servers and writes stats.json.
// Run by the GitHub Action; uses curl because GD blocks requests that send a User-Agent.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const NAME = process.env.GD_NAME || "MindSniping";
const BASE = "https://www.boomlings.com/database";
const SECRET = "Wmfd2893gb7"; // public secret the game itself uses

function post(endpoint, params) {
  const body = new URLSearchParams({
    gameVersion: "22", binaryVersion: "51", secret: SECRET, ...params,
  }).toString();
  return execFileSync(
    "curl",
    ["-sS", "--fail", "-X", "POST", `${BASE}/${endpoint}`, "-d", body, "-A", ""],
    { encoding: "utf8" }
  );
}

// "1:name:2:123:3:9990" -> { "1": "name", "2": "123", "3": "9990" }
function parse(str) {
  const p = str.split(":");
  const o = {};
  for (let i = 0; i + 1 < p.length; i += 2) o[p[i]] = p[i + 1];
  return o;
}

const search = post("getGJUsers20.php", { str: NAME, total: "0", page: "0" });
if (search.trim() === "-1" || !search.includes(":")) throw new Error("Player not found");

const matches = search.split("#")[0].split("|").map(parse);
const user = matches.find(u => (u["1"] || "").toLowerCase() === NAME.toLowerCase()) || matches[0];

const raw = post("getGJUserInfo20.php", { targetAccountID: user["16"] });
if (raw.trim() === "-1" || !raw.includes(":")) throw new Error("Could not load stats");
const i = parse(raw);

const stats = {
  name: i["1"],
  stars: +i["3"] || 0,
  moons: +i["52"] || 0,
  diamonds: +i["46"] || 0,
  secretCoins: +i["13"] || 0,
  userCoins: +i["17"] || 0,
  demons: +i["4"] || 0,
  creatorPoints: +i["8"] || 0,
  updated: new Date().toISOString(),
};

writeFileSync("stats.json", JSON.stringify(stats, null, 2) + "\n");
console.log(stats);
