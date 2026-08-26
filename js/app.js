(function () {
  var cfg = window.HAPJU_CONFIG;
  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var START = cfg.startHour;
  var END = cfg.endHour;

  var globalData = { members: [], unavailabilities: {}, submissions: {} };
  var CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  var state = {
    currentUser: "",
    monday: getMonday(new Date()),
    selectedDayIndex: todayIndex(),
    uiUnavailabilities: {},
    uiReasons: {},
    paint: null,
    dirty: false,
    memberQuery: "",
    memberInitial: "전체",
    adminTab: "heat",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDateStr(dateObj) {
    return (
      dateObj.getFullYear() +
      "-" +
      pad(dateObj.getMonth() + 1) +
      "-" +
      pad(dateObj.getDate())
    );
  }

  function getMonday(d) {
    var date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    var day = date.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  function todayIndex() {
    var day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  }

  function addDays(base, n) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
  }

  function weekDates() {
    var list = [];
    for (var i = 0; i < 7; i++) list.push(addDays(state.monday, i));
    return list;
  }

  function cellKey(dateStr, hour) {
    return dateStr + "_" + hour;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function hangulInitial(ch) {
    var code = String(ch || "").charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return CHO[Math.floor((code - 0xac00) / 588)];
    var up = String(ch || "").toUpperCase();
    if (/[A-Z]/.test(up)) return up;
    if (/[0-9]/.test(up)) return "#";
    return "기타";
  }

  function hangulInitials(name) {
    var out = "";
    for (var i = 0; i < name.length; i++) out += hangulInitial(name.charAt(i));
    return out;
  }

  function memberMatches(name, query, initial) {
    if (initial && initial !== "전체" && hangulInitial(name.charAt(0)) !== initial) return false;
    var q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    if (name.toLowerCase().indexOf(q) >= 0) return true;
    if (hangulInitials(name).indexOf(q) >= 0) return true;
    return false;
  }

  function hourRanges(hours) {
    if (!hours.length) return "";
    hours = hours.slice().sort(function (a, b) {
      return a - b;
    });
    var parts = [];
    var start = hours[0];
    var prev = hours[0];
    for (var i = 1; i <= hours.length; i++) {
      if (i === hours.length || hours[i] !== prev + 1) {
        parts.push(start === prev ? start + ":00" : start + ":00–" + (prev + 1) + ":00");
        if (i < hours.length) {
          start = hours[i];
          prev = hours[i];
        }
      } else {
        prev = hours[i];
      }
    }
    return parts.join(", ");
  }

  function prettyDate(dateStr) {
    var p = dateStr.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
    return d.getMonth() + 1 + "/" + d.getDate() + "(" + DAYS[d.getDay()] + ")";
  }

  function showToast(message, kind) {
    var el = $("toast");
    el.textContent = message;
    el.className = "toast show " + (kind || "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.remove("show");
    }, 2400);
  }

  function setSyncLabel(text) {
    var nodes = document.querySelectorAll("[data-sync-label]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
  }

  function persistDraft() {
    if (!state.currentUser) return;
    HapjuStorage.setDraft(state.currentUser, {
      monday: formatDateStr(state.monday),
      uiUnavailabilities: state.uiUnavailabilities,
      uiReasons: state.uiReasons,
      selectedDayIndex: state.selectedDayIndex,
    });
    state.dirty = true;
    setSyncLabel("이 기기에 저장됨");
  }

  function loadUserState(user) {
    state.currentUser = user;
    state.uiUnavailabilities = {};
    state.uiReasons = {};
    var userUnavail = (globalData.unavailabilities && globalData.unavailabilities[user]) || {};
    Object.keys(userUnavail).forEach(function (key) {
      state.uiUnavailabilities[key] = true;
      var dateStr = key.split("_")[0];
      if (userUnavail[key]) state.uiReasons[dateStr] = userUnavail[key];
    });
    var draft = HapjuStorage.getDraft(user);
    if (draft && draft.uiUnavailabilities) {
      state.uiUnavailabilities = draft.uiUnavailabilities;
      state.uiReasons = draft.uiReasons || {};
      if (draft.monday) {
        var p = draft.monday.split("-");
        state.monday = getMonday(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0));
      }
      if (typeof draft.selectedDayIndex === "number") {
        state.selectedDayIndex = draft.selectedDayIndex;
      }
    }
  }

  function collectUserUnavail() {
    var out = {};
    Object.keys(state.uiUnavailabilities).forEach(function (key) {
      if (!state.uiUnavailabilities[key]) return;
      var dateStr = key.split("_")[0];
      out[key] = state.uiReasons[dateStr] || "";
    });
    return out;
  }

  function applyCell(dateStr, hour, value) {
    var key = cellKey(dateStr, hour);
    if (value) state.uiUnavailabilities[key] = true;
    else delete state.uiUnavailabilities[key];
    var nodes = document.querySelectorAll('[data-cell="' + key + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("is-off", !!value);
      nodes[i].setAttribute("aria-pressed", value ? "true" : "false");
      var label = nodes[i].querySelector("b");
      if (label) label.textContent = value ? "불가" : "가능";
    }
  }

  function groupedHours() {
    var grouped = {};
    Object.keys(state.uiUnavailabilities).forEach(function (key) {
      if (!state.uiUnavailabilities[key]) return;
      var parts = key.split("_");
      var dateStr = parts[0];
      var hour = parseInt(parts[1], 10);
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(hour);
    });
    return grouped;
  }

  function renderReasons() {
    var container = $("reason-list");
    var grouped = groupedHours();
    var dates = Object.keys(grouped).sort();
    if (!dates.length) {
      container.innerHTML = '<p class="empty-hint">칠한 시간이 있으면 날짜별 사유를 적을 수 있습니다.</p>';
      return;
    }
    var html = "";
    dates.forEach(function (dateStr) {
      var label = prettyDate(dateStr);
      var range = hourRanges(grouped[dateStr]);
      var reason = state.uiReasons[dateStr] || "";
      html +=
        '<label class="reason-row">' +
        '<span class="reason-meta"><strong>' +
        escapeHtml(label) +
        "</strong><small>" +
        escapeHtml(range) +
        "</small></span>" +
        '<input type="text" data-reason-date="' +
        escapeHtml(dateStr) +
        '" value="' +
        escapeHtml(reason) +
        '" placeholder="예: 수업, 알바, 약속">' +
        "</label>";
    });
    container.innerHTML = html;
  }

  function renderWeekLabel() {
    var start = state.monday;
    var end = addDays(state.monday, 6);
    $("week-label").textContent =
      start.getMonth() +
      1 +
      "/" +
      start.getDate() +
      "(" +
      DAYS[start.getDay()] +
      ") – " +
      (end.getMonth() + 1) +
      "/" +
      end.getDate() +
      "(" +
      DAYS[end.getDay()] +
      ")";
  }

  function renderDayChips() {
    var wrap = $("day-chips");
    var html = "";
    weekDates().forEach(function (d, i) {
      var dateStr = formatDateStr(d);
      var grouped = groupedHours();
      var count = grouped[dateStr] ? grouped[dateStr].length : 0;
      html +=
        '<button type="button" class="day-chip' +
        (i === state.selectedDayIndex ? " is-active" : "") +
        (count ? " has-off" : "") +
        '" data-day-index="' +
        i +
        '">' +
        "<span>" +
        DAYS[d.getDay()] +
        "</span>" +
        "<strong>" +
        d.getDate() +
        "</strong>" +
        (count ? "<em>" + count + "</em>" : "") +
        "</button>";
    });
    wrap.innerHTML = html;
  }

  function renderHourList() {
    var date = weekDates()[state.selectedDayIndex];
    var dateStr = formatDateStr(date);
    $("mobile-day-title").textContent = prettyDate(dateStr);
    var html = "";
    for (var h = START; h <= END; h++) {
      var key = cellKey(dateStr, h);
      var off = !!state.uiUnavailabilities[key];
      html +=
        '<button type="button" class="hour-btn' +
        (off ? " is-off" : "") +
        '" data-cell="' +
        key +
        '" data-date="' +
        dateStr +
        '" data-hour="' +
        h +
        '" aria-pressed="' +
        (off ? "true" : "false") +
        '"><span>' +
        h +
        ":00</span><b>" +
        (off ? "불가" : "가능") +
        "</b></button>";
    }
    $("hour-list").innerHTML = html;
  }

  function renderGrid() {
    var dates = weekDates();
    var head = "<tr><th>시간</th>";
    dates.forEach(function (d) {
      head +=
        "<th><span>" +
        (d.getMonth() + 1) +
        "/" +
        d.getDate() +
        "</span>" +
        DAYS[d.getDay()] +
        "</th>";
    });
    head += "</tr>";
    $("grid-head").innerHTML = head;

    var body = "";
    for (var h = START; h <= END; h++) {
      body += "<tr><th>" + h + ":00</th>";
      dates.forEach(function (d) {
        var dateStr = formatDateStr(d);
        var key = cellKey(dateStr, h);
        var off = !!state.uiUnavailabilities[key];
        body +=
          '<td class="' +
          (off ? "is-off" : "") +
          '" data-cell="' +
          key +
          '" data-date="' +
          dateStr +
          '" data-hour="' +
          h +
          '" aria-pressed="' +
          (off ? "true" : "false") +
          '" role="button" tabindex="0"></td>';
      });
      body += "</tr>";
    }
    $("grid-body").innerHTML = body;
  }

  function renderSchedule() {
    renderWeekLabel();
    renderDayChips();
    renderHourList();
    renderGrid();
    renderReasons();
  }

  function showView(name) {
    $("view-select").hidden = name !== "select";
    $("view-schedule").hidden = name !== "schedule";
    $("view-admin").hidden = name !== "admin";
  }

  function renderChosungChips() {
    var wrap = $("chosung-chips");
    var present = {};
    globalData.members.forEach(function (name) {
      present[hangulInitial(name.charAt(0))] = true;
    });
    var keys = Object.keys(present).sort(function (a, b) {
      var ia = CHO.indexOf(a);
      var ib = CHO.indexOf(b);
      if (ia < 0 && ib < 0) return a.localeCompare(b);
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
    var html = '<button type="button" class="chip' + (state.memberInitial === "전체" ? " is-on" : "") + '" data-initial="전체">전체</button>';
    keys.forEach(function (k) {
      html +=
        '<button type="button" class="chip' +
        (state.memberInitial === k ? " is-on" : "") +
        '" data-initial="' +
        escapeHtml(k) +
        '">' +
        escapeHtml(k) +
        "</button>";
    });
    wrap.innerHTML = html;
  }

  function renderMemberSelect() {
    var box = $("member-list");
    var last = HapjuStorage.getUser();
    if (!globalData.members.length) {
      box.innerHTML =
        '<p class="empty-hint">연결된 명단이 없습니다. 미리보기 이름으로 입력하거나, 시트 연결 후 다시 열어 주세요.</p>';
      $("member-count").textContent = "";
      return;
    }
    var names = globalData.members.filter(function (name) {
      return memberMatches(name, state.memberQuery, state.memberInitial);
    });
    names.sort(function (a, b) {
      if (a === last) return -1;
      if (b === last) return 1;
      return a.localeCompare(b, "ko");
    });
    if (!names.length) {
      box.innerHTML = '<p class="empty-hint">찾는 이름이 없습니다. 검색어나 초성을 바꿔 보세요.</p>';
    } else {
      var html = "";
      names.forEach(function (name) {
        html +=
          '<button type="button" class="member-btn' +
          (name === last ? " is-last" : "") +
          '" data-member="' +
          escapeHtml(name) +
          '">' +
          escapeHtml(name) +
          "</button>";
      });
      box.innerHTML = html;
    }
    $("member-count").textContent =
      "전체 " + globalData.members.length + "명 중 " + names.length + "명";
    renderChosungChips();
  }

  function submittedThisWeek(name) {
    var sub = (globalData.submissions && globalData.submissions[name]) || null;
    var week = formatDateStr(state.monday);
    if (sub && sub.week === week) return true;
    var map = (globalData.unavailabilities && globalData.unavailabilities[name]) || {};
    var dates = weekDates().map(formatDateStr);
    return Object.keys(map).some(function (key) {
      return dates.indexOf(key.split("_")[0]) >= 0;
    });
  }

  function isBusy(name, dateStr, hour) {
    var map = (globalData.unavailabilities && globalData.unavailabilities[name]) || {};
    return !!map[cellKey(dateStr, hour)];
  }

  function renderAdminHeat() {
    var members = globalData.members || [];
    var submitted = members.filter(submittedThisWeek);
    var dates = weekDates();
    $("admin-sub-count").textContent =
      "이번 주 입력 " + submitted.length + " / " + members.length + "명 · 숫자는 가능한 인원";
    var head = "<tr><th>시간</th>";
    dates.forEach(function (d) {
      head +=
        "<th><span>" +
        (d.getMonth() + 1) +
        "/" +
        d.getDate() +
        "</span>" +
        DAYS[d.getDay()] +
        "</th>";
    });
    head += "</tr>";
    $("admin-grid-head").innerHTML = head;
    var pool = submitted.length ? submitted : members;
    var body = "";
    for (var h = START; h <= END; h++) {
      body += "<tr><th>" + h + ":00</th>";
      dates.forEach(function (d) {
        var dateStr = formatDateStr(d);
        var free = 0;
        pool.forEach(function (name) {
          if (!isBusy(name, dateStr, h)) free += 1;
        });
        var ratio = pool.length ? free / pool.length : 0;
        var cls = ratio >= 0.8 ? "heat-good" : ratio >= 0.5 ? "heat-ok" : "heat-bad";
        body +=
          '<td class="heat-cell ' +
          cls +
          '" data-admin-date="' +
          dateStr +
          '" data-admin-hour="' +
          h +
          '">' +
          free +
          "</td>";
      });
      body += "</tr>";
    }
    $("admin-grid-body").innerHTML = body;
  }

  function renderAdminStatus() {
    var box = $("admin-status-list");
    var members = (globalData.members || []).slice().sort(function (a, b) {
      return a.localeCompare(b, "ko");
    });
    if (!members.length) {
      box.innerHTML = '<p class="empty-hint">명단이 없습니다.</p>';
      return;
    }
    var html = "";
    members.forEach(function (name) {
      var done = submittedThisWeek(name);
      html +=
        '<div class="status-row">' +
        "<strong>" +
        escapeHtml(name) +
        "</strong>" +
        '<span class="' +
        (done ? "ok" : "wait") +
        '">' +
        (done ? "입력함" : "미입력") +
        "</span></div>";
    });
    box.innerHTML = html;
  }

  function renderAdminRoster() {
    $("admin-roster").value = (globalData.members || []).join("\n");
  }

  function renderAdminWeekLabel() {
    var start = state.monday;
    var end = addDays(state.monday, 6);
    $("admin-week-label").textContent =
      start.getMonth() +
      1 +
      "/" +
      start.getDate() +
      "(" +
      DAYS[start.getDay()] +
      ") – " +
      (end.getMonth() + 1) +
      "/" +
      end.getDate() +
      "(" +
      DAYS[end.getDay()] +
      ")";
  }

  function renderAdmin() {
    renderAdminWeekLabel();
    $("admin-heat").hidden = state.adminTab !== "heat";
    $("admin-status").hidden = state.adminTab !== "status";
    $("admin-roster-wrap").hidden = state.adminTab !== "roster";
    document.querySelectorAll("[data-admin-tab]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-admin-tab") === state.adminTab);
    });
    if (state.adminTab === "heat") renderAdminHeat();
    if (state.adminTab === "status") renderAdminStatus();
    if (state.adminTab === "roster") renderAdminRoster();
  }

  function showAdminDetail(dateStr, hour) {
    var members = globalData.members || [];
    var submitted = members.filter(submittedThisWeek);
    var pool = submitted.length ? submitted : members;
    var free = [];
    var busy = [];
    pool.forEach(function (name) {
      if (isBusy(name, dateStr, hour)) busy.push(name);
      else free.push(name);
    });
    $("admin-detail").hidden = false;
    $("admin-detail-title").textContent = prettyDate(dateStr) + " " + hour + ":00";
    $("admin-detail-body").innerHTML =
      "<p>가능 " +
      free.length +
      "명 · 불가 " +
      busy.length +
      "명</p>" +
      '<div class="detail-cols"><div><h3>가능</h3><p>' +
      (free.length ? free.map(escapeHtml).join("<br>") : "-") +
      "</p></div><div><h3>불가</h3><p>" +
      (busy.length ? busy.map(escapeHtml).join("<br>") : "-") +
      "</p></div></div>";
  }

  function enterAdmin() {
    var pin = $("admin-pin").value;
    if (String(pin) !== String(cfg.adminPin || "0000")) {
      showToast("관리자 비밀번호가 다릅니다.", "warn");
      return;
    }
    sessionStorage.setItem("hapju-admin", "1");
    $("admin-gate").hidden = true;
    $("admin-pin").value = "";
    renderAdmin();
    showView("admin");
  }

  function startInput(user) {
    if (!user) {
      showToast("이름을 선택해 주세요.", "warn");
      return;
    }
    HapjuStorage.setUser(user);
    loadUserState(user);
    $("header-name").textContent = user;
    renderSchedule();
    showView("schedule");
    setSyncLabel(HapjuSync.isEmbedded() || HapjuStorage.getGasUrl() ? "시트와 동기화 가능" : "이 기기에서만 저장");
  }

  function fillDay(value) {
    var dateStr = formatDateStr(weekDates()[state.selectedDayIndex]);
    for (var h = START; h <= END; h++) applyCell(dateStr, h, value);
    persistDraft();
    renderDayChips();
    renderReasons();
  }

  function onPaintStart(ev) {
    var cell = ev.target.closest("[data-date][data-hour]");
    if (!cell) return;
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    ev.preventDefault();
    var dateStr = cell.getAttribute("data-date");
    var hour = Number(cell.getAttribute("data-hour"));
    var key = cellKey(dateStr, hour);
    state.paint = { value: !state.uiUnavailabilities[key] };
    applyCell(dateStr, hour, state.paint.value);
    if (ev.currentTarget.setPointerCapture) {
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } catch (e) {}
    }
  }

  function onPaintMove(ev) {
    if (!state.paint) return;
    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!el) return;
    var cell = el.closest("[data-date][data-hour]");
    if (!cell) return;
    applyCell(cell.getAttribute("data-date"), Number(cell.getAttribute("data-hour")), state.paint.value);
  }

  function onPaintEnd() {
    if (!state.paint) return;
    state.paint = null;
    persistDraft();
    renderDayChips();
    renderReasons();
    renderHourList();
  }

  function bindPaint(el) {
    el.addEventListener("pointerdown", onPaintStart);
    el.addEventListener("pointermove", onPaintMove);
    el.addEventListener("pointerup", onPaintEnd);
    el.addEventListener("pointercancel", onPaintEnd);
  }

  function saveSchedule() {
    var btns = [$("save-btn"), $("save-btn-bar")];
    var user = state.currentUser;
    var payload = collectUserUnavail();
    persistDraft();
    btns.forEach(function (btn) {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = "저장 중…";
    });
      HapjuSync
      .save(user, payload, { week: formatDateStr(state.monday) })
      .then(function (result) {
        state.dirty = false;
        if (result && result.localOnly) {
          showToast("이 기기에 저장했습니다. 시트 URL을 연결하면 공유됩니다.");
          setSyncLabel("이 기기에만 저장됨");
        } else {
          showToast("저장했습니다.");
          setSyncLabel("시트에 반영됨");
        }
      })
      .catch(function () {
        showToast("시트 저장에 실패해 이 기기에만 남겼습니다.", "warn");
        setSyncLabel("로컬만 저장됨");
      })
      .then(function () {
        btns.forEach(function (btn) {
          if (!btn) return;
          btn.disabled = false;
          btn.textContent = "저장";
        });
      });
  }

  function usePreviewMembers() {
    var local = HapjuStorage.getLocalMembers();
    var cache = HapjuStorage.getCache() || {};
    globalData = {
      members: local.length ? local : cfg.fallbackMembers.slice(),
      unavailabilities: cache.unavailabilities || {},
      submissions: cache.submissions || {},
    };
    renderMemberSelect();
    $("connect-status").textContent = local.length
      ? "이 기기에 저장된 명단입니다."
      : "미리보기 명단으로 입력할 수 있습니다.";
  }

  function initMembers() {
    $("gas-url").value = HapjuStorage.getGasUrl() || cfg.gasWebAppUrl || "";
    if (!HapjuSync.isEmbedded() && !HapjuStorage.getGasUrl()) {
      usePreviewMembers();
      setSyncLabel("이 기기에서만 저장");
      var lastLocal = HapjuStorage.getUser();
      if (lastLocal && globalData.members.indexOf(lastLocal) >= 0) {
        $("quick-resume").hidden = false;
        $("quick-resume-name").textContent = lastLocal;
      }
      return;
    }
    setSyncLabel("명단을 불러오는 중…");
    HapjuSync
      .load()
      .then(function (data) {
        if (data && data.members && data.members.length) {
          globalData = data;
          if (!globalData.submissions) globalData.submissions = {};
          renderMemberSelect();
          $("connect-status").textContent = HapjuSync.isEmbedded()
            ? "시트에 연결되어 있습니다."
            : "시트 명단을 불러왔습니다.";
          setSyncLabel("시트 연결됨");
          var last = HapjuStorage.getUser();
          if (last && data.members.indexOf(last) >= 0) {
            $("quick-resume").hidden = false;
            $("quick-resume-name").textContent = last;
          }
        } else {
          usePreviewMembers();
        }
      })
      .catch(function () {
        usePreviewMembers();
      });
  }

  function registerPwa() {
    if (!("serviceWorker" in navigator)) return;
    if (HapjuSync.isEmbedded()) return;
    if (location.protocol === "file:") return;
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("app-title").textContent = cfg.title;
    $("select-title").textContent = cfg.title;

    $("member-list").addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-member]");
      if (btn) startInput(btn.getAttribute("data-member"));
    });

    $("quick-resume").addEventListener("click", function () {
      startInput(HapjuStorage.getUser());
    });

    $("btn-back").addEventListener("click", function () {
      showView("select");
    });

    $("week-prev").addEventListener("click", function () {
      state.monday = addDays(state.monday, -7);
      persistDraft();
      renderSchedule();
    });
    $("week-next").addEventListener("click", function () {
      state.monday = addDays(state.monday, 7);
      persistDraft();
      renderSchedule();
    });

    $("day-chips").addEventListener("click", function (ev) {
      var chip = ev.target.closest("[data-day-index]");
      if (!chip) return;
      state.selectedDayIndex = Number(chip.getAttribute("data-day-index"));
      persistDraft();
      renderDayChips();
      renderHourList();
    });

    $("fill-off").addEventListener("click", function () {
      fillDay(true);
      renderHourList();
    });
    $("fill-clear").addEventListener("click", function () {
      fillDay(false);
      renderHourList();
    });

    bindPaint($("hour-list"));
    bindPaint($("schedule-grid"));

    $("reason-list").addEventListener("input", function (ev) {
      var input = ev.target.closest("[data-reason-date]");
      if (!input) return;
      state.uiReasons[input.getAttribute("data-reason-date")] = input.value;
      persistDraft();
    });

    $("save-btn").addEventListener("click", saveSchedule);
    $("save-btn-bar").addEventListener("click", saveSchedule);

    $("save-gas-url").addEventListener("click", function () {
      HapjuStorage.setGasUrl($("gas-url").value);
      showToast("시트 주소를 저장했습니다.");
      initMembers();
    });

    $("toggle-settings").addEventListener("click", function () {
      var panel = $("settings-panel");
      panel.hidden = !panel.hidden;
    });

    $("member-search").addEventListener("input", function (ev) {
      state.memberQuery = ev.target.value;
      renderMemberSelect();
    });
    $("chosung-chips").addEventListener("click", function (ev) {
      var chip = ev.target.closest("[data-initial]");
      if (!chip) return;
      state.memberInitial = chip.getAttribute("data-initial");
      renderMemberSelect();
    });

    $("btn-admin").addEventListener("click", function () {
      if (sessionStorage.getItem("hapju-admin") === "1") {
        renderAdmin();
        showView("admin");
        return;
      }
      $("admin-gate").hidden = !$("admin-gate").hidden;
      if (!$("admin-gate").hidden) $("admin-pin").focus();
    });
    $("admin-pin-go").addEventListener("click", enterAdmin);
    $("admin-pin").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") enterAdmin();
    });
    $("btn-admin-back").addEventListener("click", function () {
      showView("select");
    });
    $("admin-week-prev").addEventListener("click", function () {
      state.monday = addDays(state.monday, -7);
      renderAdmin();
    });
    $("admin-week-next").addEventListener("click", function () {
      state.monday = addDays(state.monday, 7);
      renderAdmin();
    });
    document.querySelector(".admin-tabs").addEventListener("click", function (ev) {
      var tab = ev.target.closest("[data-admin-tab]");
      if (!tab) return;
      state.adminTab = tab.getAttribute("data-admin-tab");
      $("admin-detail").hidden = true;
      renderAdmin();
    });
    $("admin-grid").addEventListener("click", function (ev) {
      var cell = ev.target.closest("[data-admin-date]");
      if (!cell) return;
      showAdminDetail(cell.getAttribute("data-admin-date"), Number(cell.getAttribute("data-admin-hour")));
    });
    $("admin-detail-close").addEventListener("click", function () {
      $("admin-detail").hidden = true;
    });
    $("admin-save-roster").addEventListener("click", function () {
      var names = $("admin-roster")
        .value.split(/\r?\n/)
        .map(function (n) {
          return n.trim();
        })
        .filter(Boolean);
      var unique = [];
      names.forEach(function (n) {
        if (unique.indexOf(n) < 0) unique.push(n);
      });
      globalData.members = unique;
      HapjuSync.saveMembers(unique).then(function (result) {
        renderMemberSelect();
        renderAdmin();
        showToast(result && result.localOnly ? "이 기기에 명단을 저장했습니다." : "명단을 저장했습니다.");
      }).catch(function () {
        showToast("명단은 이 기기에만 저장됐습니다.", "warn");
        renderMemberSelect();
      });
    });

    initMembers();
    registerPwa();
  });
})();
