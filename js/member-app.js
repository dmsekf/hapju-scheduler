(function () {
  var cfg = window.HAPJU_CONFIG;
  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var START = cfg.startHour;
  var END = cfg.endHour;
  var CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

  var db = HapjuStorage.emptyDb();
  var state = {
    currentUser: "",
    monday: getMonday(new Date()),
    selectedDayIndex: todayIndex(),
    uiUnavailabilities: {},
    uiReasons: {},
    paint: null,
    memberQuery: "",
    memberInitial: "전체",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDateStr(dateObj) {
    return dateObj.getFullYear() + "-" + pad(dateObj.getMonth() + 1) + "-" + pad(dateObj.getDate());
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
      } else prev = hours[i];
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

  function persistDraft() {
    if (!state.currentUser) return;
    HapjuStorage.setDraft(state.currentUser, {
      monday: formatDateStr(state.monday),
      uiUnavailabilities: state.uiUnavailabilities,
      uiReasons: state.uiReasons,
      selectedDayIndex: state.selectedDayIndex,
    });
  }

  function groupedHours() {
    var grouped = {};
    Object.keys(state.uiUnavailabilities).forEach(function (key) {
      if (!state.uiUnavailabilities[key]) return;
      var parts = key.split("_");
      if (!grouped[parts[0]]) grouped[parts[0]] = [];
      grouped[parts[0]].push(parseInt(parts[1], 10));
    });
    return grouped;
  }

  function applyCell(dateStr, hour, value) {
    var key = cellKey(dateStr, hour);
    if (value) state.uiUnavailabilities[key] = true;
    else delete state.uiUnavailabilities[key];
    var nodes = document.querySelectorAll('[data-cell="' + key + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("is-off", !!value);
      var label = nodes[i].querySelector("b");
      if (label) label.textContent = value ? "불가" : "가능";
    }
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
      html +=
        '<label class="reason-row"><span class="reason-meta"><strong>' +
        escapeHtml(prettyDate(dateStr)) +
        "</strong><small>" +
        escapeHtml(hourRanges(grouped[dateStr])) +
        '</small></span><input type="text" data-reason-date="' +
        escapeHtml(dateStr) +
        '" value="' +
        escapeHtml(state.uiReasons[dateStr] || "") +
        '" placeholder="예: 수업, 알바, 약속"></label>';
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
    var grouped = groupedHours();
    weekDates().forEach(function (d, i) {
      var dateStr = formatDateStr(d);
      var count = grouped[dateStr] ? grouped[dateStr].length : 0;
      html +=
        '<button type="button" class="day-chip' +
        (i === state.selectedDayIndex ? " is-active" : "") +
        (count ? " has-off" : "") +
        '" data-day-index="' +
        i +
        '"><span>' +
        DAYS[d.getDay()] +
        "</span><strong>" +
        d.getDate() +
        "</strong>" +
        (count ? "<em>" + count + "</em>" : "") +
        "</button>";
    });
    wrap.innerHTML = html;
  }

  function renderHourList() {
    var dateStr = formatDateStr(weekDates()[state.selectedDayIndex]);
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
      head += "<th><span>" + (d.getMonth() + 1) + "/" + d.getDate() + "</span>" + DAYS[d.getDay()] + "</th>";
    });
    $("grid-head").innerHTML = head + "</tr>";
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
          '"></td>';
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
    $("view-done").hidden = name !== "done";
  }

  function showEmpty(message) {
    $("select-card").innerHTML =
      "<h1>스케줄러 준비 중</h1><p class=\"lead\">" +
      (message || "관리자가 엑셀 명단을 올린 뒤에 사용할 수 있습니다.") +
      "</p>";
  }

  function initMembers() {
    HapjuSync.load()
      .then(function (data) {
        db = data;
        if (!db.members.length && !HapjuSync.hasServer()) {
          db.members = cfg.fallbackMembers.slice();
          $("connect-status").textContent =
            "이 기기의 미리보기입니다. Netlify 주소에서 관리자가 엑셀을 올리면 휴대폰과 공유됩니다.";
        }
        if (!db.members.length) {
          showEmpty("관리자가 Netlify 사이트 주소의 관리자 페이지에서 엑셀을 올려야 합니다.");
          return;
        }
        renderMemberSelect();
        var last = HapjuStorage.getUser();
        if (last && db.members.indexOf(last) >= 0) {
          $("quick-resume").hidden = false;
          $("quick-resume-name").textContent = last;
        }
      })
      .catch(function (err) {
        var msg = (err && err.message) || "서버에 연결하지 못했습니다.";
        showEmpty(msg + " Netlify 배포가 Published인지 확인한 뒤 새로고침 해 주세요.");
      });
  }

  function renderChosungChips() {
    var present = {};
    db.members.forEach(function (name) {
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
    $("chosung-chips").innerHTML = html;
  }

  function renderMemberSelect() {
    if (!db.members.length) {
      showEmpty();
      return;
    }
    var last = HapjuStorage.getUser();
    var names = db.members.filter(function (name) {
      return memberMatches(name, state.memberQuery, state.memberInitial);
    });
    names.sort(function (a, b) {
      if (a === last) return -1;
      if (b === last) return 1;
      return a.localeCompare(b, "ko");
    });
    var box = $("member-list");
    if (!names.length) {
      box.innerHTML = '<p class="empty-hint">찾는 이름이 없습니다.</p>';
    } else {
      box.innerHTML = names
        .map(function (name) {
          return (
            '<button type="button" class="member-btn' +
            (name === last ? " is-last" : "") +
            '" data-member="' +
            escapeHtml(name) +
            '">' +
            escapeHtml(name) +
            "</button>"
          );
        })
        .join("");
    }
    $("member-count").textContent = "전체 " + db.members.length + "명 중 " + names.length + "명";
    renderChosungChips();
  }

  function startInput(user) {
    if (!user) {
      showToast("이름을 선택해 주세요.", "warn");
      return;
    }
    HapjuStorage.setUser(user);
    state.currentUser = user;
    state.uiUnavailabilities = {};
    state.uiReasons = {};
    var userUnavail = db.unavailabilities[user] || {};
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
      if (typeof draft.selectedDayIndex === "number") state.selectedDayIndex = draft.selectedDayIndex;
    }
    $("header-name").textContent = user;
    renderSchedule();
    showView("schedule");
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
    state.paint = { value: !state.uiUnavailabilities[cellKey(dateStr, hour)] };
    applyCell(dateStr, hour, state.paint.value);
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch (e) {}
  }

  function onPaintMove(ev) {
    if (!state.paint) return;
    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    var cell = el && el.closest("[data-date][data-hour]");
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

  function collectUserUnavail() {
    var out = {};
    Object.keys(state.uiUnavailabilities).forEach(function (key) {
      if (!state.uiUnavailabilities[key]) return;
      out[key] = state.uiReasons[key.split("_")[0]] || "";
    });
    return out;
  }

  function saveSchedule() {
    var btns = [$("save-btn"), $("save-btn-bar")];
    persistDraft();
    btns.forEach(function (btn) {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = "저장 중…";
    });
    HapjuSync.saveUser(state.currentUser, collectUserUnavail())
      .then(function () {
        $("done-name").textContent = state.currentUser;
        showView("done");
      })
      .catch(function () {
        showToast("저장에 실패했습니다. 다시 눌러 주세요.", "warn");
        btns.forEach(function (btn) {
          if (!btn) return;
          btn.disabled = false;
          btn.textContent = "저장";
        });
      });
  }

  function openAdmin() {
    window.location.href = "admin.html";
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
    $("btn-admin").addEventListener("click", openAdmin);
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
    $("btn-close-window").addEventListener("click", function () {
      window.close();
      setTimeout(function () {
        $("close-hint").hidden = false;
      }, 300);
    });
    $("btn-done-again").addEventListener("click", function () {
      showView("select");
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
    initMembers();
  });
})();
