(function (global) {
  var prefix = (global.HAPJU_CONFIG && global.HAPJU_CONFIG.storagePrefix) || "hapju.";

  function key(name) {
    return prefix + name;
  }

  function read(name, fallback) {
    try {
      var raw = localStorage.getItem(key(name));
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function emptyDb() {
    return { parsedData: [], members: [], unavailabilities: {} };
  }

  function shape(data) {
    data = data && typeof data === "object" ? data : emptyDb();
    if (!Array.isArray(data.parsedData)) data.parsedData = [];
    if (!Array.isArray(data.members)) data.members = [];
    if (!data.unavailabilities || typeof data.unavailabilities !== "object") {
      data.unavailabilities = {};
    }
    return data;
  }

  global.HapjuStorage = {
    shape: shape,
    emptyDb: emptyDb,
    getUser: function () {
      return read("currentUser", "");
    },
    setUser: function (name) {
      write("currentUser", name || "");
    },
    getDraft: function (user) {
      if (!user) return null;
      return read("draft." + user, null);
    },
    setDraft: function (user, draft) {
      if (!user) return;
      write("draft." + user, draft);
    },
    getDb: function () {
      return shape(read("db", emptyDb()));
    },
    setDb: function (data) {
      write("db", shape(data));
    },
    getAdminPin: function () {
      var pin = read("adminPin", null);
      if (pin) return String(pin);
      return (global.HAPJU_CONFIG && global.HAPJU_CONFIG.adminPin) || "1234";
    },
    setAdminPin: function (pin) {
      write("adminPin", String(pin || "").trim());
    },
  };
})(window);
