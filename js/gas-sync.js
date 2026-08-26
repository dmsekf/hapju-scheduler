(function (global) {
  function empty() {
    return HapjuStorage.emptyDb();
  }

  function parseDb(raw) {
    if (raw == null || raw === "") return empty();
    try {
      return HapjuStorage.shape(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (e) {
      return empty();
    }
  }

  function apiUrl() {
    if (typeof location === "undefined") return "";
    if (location.protocol === "file:") return "";
    return "/.netlify/functions/schedule";
  }

  function readError(res, data) {
    if (data && data.error) return data.error;
    return "서버 응답 " + res.status;
  }

  function readJson(res) {
    return res.text().then(function (text) {
      var data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(
            res.status === 404
              ? "저장 서버가 아직 배포되지 않았습니다. Netlify 배포가 끝날 때까지 기다려 주세요."
              : "서버 응답을 읽지 못했습니다."
          );
        }
      }
      if (!res.ok) throw new Error(readError(res, data));
      return data;
    });
  }

  function load() {
    var url = apiUrl();
    if (!url) return Promise.resolve(HapjuStorage.getDb());
    return fetch(url, { cache: "no-store" }).then(function (res) {
      return readJson(res).then(function (data) {
        var db = parseDb(data);
        HapjuStorage.setDb(db);
        return db;
      });
    });
  }

  function save(db) {
    db = HapjuStorage.shape(db);
    var url = apiUrl();
    if (!url) {
      HapjuStorage.setDb(db);
      return Promise.resolve({ localOnly: true });
    }
    return fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "saveAll", data: db }),
    }).then(function (res) {
      return readJson(res).then(function (data) {
        if (data.ok === false) throw new Error(data.error || "저장에 실패했습니다.");
        HapjuStorage.setDb(db);
        return { ok: true, members: data.members };
      });
    });
  }

  function saveUser(user, userUnavail) {
    var url = apiUrl();
    if (!url) {
      var local = HapjuStorage.getDb();
      local.unavailabilities = local.unavailabilities || {};
      local.unavailabilities[user] = userUnavail;
      HapjuStorage.setDb(local);
      return Promise.resolve({ localOnly: true });
    }
    return fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "saveUser",
        user: user,
        unavailabilities: userUnavail,
      }),
    }).then(function (res) {
      return readJson(res).then(function (data) {
        if (data.ok === false) throw new Error(data.error || "저장에 실패했습니다.");
        var db = HapjuStorage.getDb();
        db.unavailabilities = db.unavailabilities || {};
        db.unavailabilities[user] = userUnavail;
        HapjuStorage.setDb(db);
        return { ok: true };
      });
    });
  }

  function postJson(body) {
    var url = apiUrl();
    if (!url) return Promise.resolve(null);
    return fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return readJson(res).then(function (data) {
        if (data.ok === false) throw new Error(data.error || "request failed");
        return data;
      });
    });
  }

  function login(pin) {
    var url = apiUrl();
    if (!url) {
      if (String(pin) === String(HapjuStorage.getAdminPin())) return Promise.resolve({ ok: true, localOnly: true });
      return Promise.reject(new Error("비밀번호가 틀렸습니다."));
    }
    return postJson({ type: "auth", pin: pin });
  }

  function changePin(oldPin, newPin) {
    var url = apiUrl();
    if (!url) {
      if (String(oldPin) !== String(HapjuStorage.getAdminPin())) {
        return Promise.reject(new Error("현재 비밀번호가 틀렸습니다."));
      }
      HapjuStorage.setAdminPin(newPin);
      return Promise.resolve({ ok: true, localOnly: true });
    }
    return postJson({ type: "setPin", oldPin: oldPin, newPin: newPin });
  }

  global.HapjuSync = {
    isEmbedded: function () {
      return false;
    },
    hasServer: function () {
      return !!apiUrl();
    },
    load: load,
    save: save,
    saveUser: saveUser,
    login: login,
    changePin: changePin,
  };
})(window);
