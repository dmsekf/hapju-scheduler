import { getStore } from "@netlify/blobs";

const emptyDb = {
  parsedData: [],
  members: [],
  unavailabilities: {},
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function shape(data) {
  const db = data && typeof data === "object" ? data : {};
  return {
    parsedData: Array.isArray(db.parsedData) ? db.parsedData : [],
    members: Array.isArray(db.members) ? db.members : [],
    unavailabilities:
      db.unavailabilities && typeof db.unavailabilities === "object"
        ? db.unavailabilities
        : {},
  };
}

function getDbStore() {
  return getStore({
    name: "hapju-scheduler",
    consistency: "strong",
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: jsonHeaders });
  }

  try {
    const store = getDbStore();

    if (req.method === "GET") {
      const data = await store.get("db", { type: "json" });
      return json(200, shape(data || emptyDb));
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const storedPin = (await store.get("adminPin", { type: "text" })) || "1234";

      if (body.type === "auth") {
        if (String(body.pin) === String(storedPin)) return json(200, { ok: true });
        return json(401, { ok: false, error: "비밀번호가 틀렸습니다." });
      }

      if (body.type === "setPin") {
        if (String(body.oldPin) !== String(storedPin)) {
          return json(401, { ok: false, error: "현재 비밀번호가 틀렸습니다." });
        }
        const nextPin = String(body.newPin || "").trim();
        if (nextPin.length < 4) {
          return json(400, { ok: false, error: "비밀번호는 4자 이상이어야 합니다." });
        }
        await store.set("adminPin", nextPin);
        return json(200, { ok: true });
      }

      const current = shape((await store.get("db", { type: "json" })) || emptyDb);

      if (body.type === "saveUser" && body.user) {
        current.unavailabilities[body.user] = body.unavailabilities || {};
        await store.setJSON("db", current);
        return json(200, { ok: true, members: current.members.length });
      }

      const next = shape(body.data || body);
      await store.setJSON("db", next);
      const verify = shape((await store.get("db", { type: "json" })) || emptyDb);
      return json(200, { ok: true, members: verify.members.length });
    }

    return json(405, { error: "method not allowed" });
  } catch (err) {
    return json(500, { error: String(err && err.message ? err.message : err) });
  }
};
