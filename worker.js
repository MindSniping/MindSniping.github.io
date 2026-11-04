// Tiny proxy: asks the Geometry Dash servers for a player's stats and returns clean JSON.
// Usage: GET /?name=MindSniping  (name is optional; DEFAULT_NAME is used if missing)

const GD = "https://www.boomlings.com/database";
const SECRET = "Wmfd2893gb7"; // public "common secret" the game itself uses
const DEFAULT_NAME = "MindSniping";
const CACHE_SECONDS = 600; // stay well under GD's rate limits

// "1:name:2:123:3:9990" -> { "1": "name", "2": "123", "3": "9990" }
function parse(str) {
  const p = str.split(":");
  const o = {};
  for (let i = 0; i + 1 < p.length; i += 2) o[p[i]] = p[i + 1];
  return o;
}

async function gd(endpoint, params) {
  const res = await fetch(`${GD}/${endpoint}`, {
    method: "POST",
    // GD sits behind Cloudflare, which blocks requests that have a User-Agent.
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "" },
    body: new URLSearchParams({ gameVersion: "22", binaryVersion: "51", secret: SECRET, ...params }),
  });
  return res.text();
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extra,
    },
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return json({}, 204);

    const name = new URL(request.url).searchParams.get("name") || DEFAULT_NAME;

    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      // 1) Find the account ID from the username
      const search = await gd("getGJUsers20.php", { str: name, total: "0", page: "0" });
      if (search === "-1" || !search.includes(":")) return json({ error: "Player not found" }, 404);

      const matches = search.split("#")[0].split("|").map(parse);
      const user = matches.find(u => (u["1"] || "").toLowerCase() === name.toLowerCase()) || matches[0];

      // 2) Get that player's stats
      const raw = await gd("getGJUserInfo20.php", { targetAccountID: user["16"] });
      if (raw === "-1" || !raw.includes(":")) return json({ error: "Could not load stats" }, 502);
      const i = parse(raw);

      const response = json(
        {
          name: i["1"],
          stars: +i["3"] || 0,
          moons: +i["52"] || 0,
          diamonds: +i["46"] || 0,
          secretCoins: +i["13"] || 0,
          userCoins: +i["17"] || 0,
          demons: +i["4"] || 0,
          creatorPoints: +i["8"] || 0,
        },
        200,
        { "Cache-Control": `public, max-age=${CACHE_SECONDS}` }
      );
      await cache.put(request, response.clone());
      return response;
    } catch (e) {
      return json({ error: "Upstream request failed" }, 502);
    }
  },
};
