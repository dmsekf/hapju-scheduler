(function () {
  var cfg = window.HAPJU_CONFIG;
  var db = HapjuStorage.emptyDb();
  var state = {
    selectedSong: null,
    filterStart: new Date(),
    filterEnd: addDays(new Date(), 27),
  };

  function $(id) {
    return document.getElementById(id);
  }

  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    x.setDate(x.getDate() + n);
    return x;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showToast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "toast show";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.remove("show");
    }, 2800);
  }

  function showView(name) {
    ["auth", "menu", "upload", "results"].forEach(function (id) {
      $("view-" + id).hidden = id !== name;
    });
    if (name === "results") renderResults();
  }

  function checkAuth() {
    var input = $("admin-pw").value;
    HapjuSync.login(input)
      .then(function () {
        showToast("인증되었습니다.");
        return HapjuSync.load();
      })
      .then(function (data) {
        db = data;
        showView("menu");
      })
      .catch(function (err) {
        showToast((err && err.message) || "비밀번호가 틀렸습니다.");
      });
  }

  function buildList(res, tone) {
    var keys = Object.keys(res);
    if (!keys.length) {
      return '<div class="empty-slot">가능한 시간이 없습니다.</div>';
    }
    return (
      '<div class="slot-scroll">' +
      keys
        .map(function (dateLabel) {
          return (
            '<div class="slot-card ' +
            tone +
            '"><div class="slot-date">' +
            escapeHtml(dateLabel) +
            '</div><div class="slot-times">' +
            res[dateLabel]
              .map(function (time) {
                return "<span>" + escapeHtml(time) + "</span>";
              })
              .join("") +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderResults() {
    var songs = HapjuMatch.songList(db.parsedData);
    var tabs = $("song-tabs");
    var box = $("song-results");
    if (!songs.length) {
      tabs.innerHTML = "";
      box.innerHTML = '<div class="panel"><p class="empty-hint">업로드된 명단이 없습니다. 엑셀을 먼저 올려 주세요.</p></div>';
      return;
    }
    if (!state.selectedSong || songs.indexOf(state.selectedSong) < 0) state.selectedSong = songs[0];
    tabs.innerHTML = songs
      .map(function (s) {
        return (
          '<button type="button" class="chip' +
          (s === state.selectedSong ? " is-on" : "") +
          '" data-song="' +
          escapeHtml(s) +
          '">' +
          escapeHtml(s) +
          "</button>"
        );
      })
      .join("");

    var song = state.selectedSong;
    var sData = HapjuMatch.songMembers(db.parsedData, song);
    var allM = HapjuMatch.uniqueNames(sData);
    var vocM = sData.filter(function (row) {
      return HapjuMatch.isVocal(row.session);
    }).map(function (row) {
      return row.name;
    });
    var instM = allM.filter(function (name) {
      return vocM.indexOf(name) < 0;
    });
    var rAll = HapjuMatch.findCommonTimesGrouped(allM, db.unavailabilities, state.filterStart, state.filterEnd);
    var rInst = instM.length ? HapjuMatch.findCommonTimesGrouped(instM, db.unavailabilities, state.filterStart, state.filterEnd) : {};

    var tags = sData
      .map(function (row) {
        var entered = db.unavailabilities[row.name] !== undefined;
        var cls = !entered ? "tag-miss" : HapjuMatch.isVocal(row.session) ? "tag-vocal" : "tag-ok";
        return (
          '<span class="tag ' +
          cls +
          '">' +
          escapeHtml(row.name) +
          "(" +
          escapeHtml(row.session) +
          ")" +
          (entered ? "" : " 미입력") +
          "</span>"
        );
      })
      .join("");

    box.innerHTML =
      '<section class="panel result-card"><h2>' +
      escapeHtml(song) +
      '</h2><div class="need-row"><span class="need-label">필요 멤버</span>' +
      tags +
      '</div><div class="result-cols"><div><h3 class="full-title">전원 참석 가능 (완전체)</h3>' +
      buildList(rAll, "emerald") +
      '</div><div><h3 class="inst-title">보컬 제외 가능 (기악 파트)</h3>' +
      buildList(rInst, "purple") +
      "</div></div></section>";
  }

  function parseExcel(file) {
    var reader = new FileReader();
    reader.onload = function (event) {
      var data = new Uint8Array(event.target.result);
      var workbook = XLSX.read(data, { type: "array" });
      var json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
      if (!json || json.length < 2) {
        showToast("데이터가 부족합니다.");
        return;
      }
      var parsed = [];
      var names = {};
      for (var i = 1; i < json.length; i++) {
        var row = json[i];
        if (!row || !row[0]) continue;
        var song = String(row[0]).trim();
        var session = String(row[1] || "").trim();
        var name = String(row[2] || "").trim();
        if (song && name) {
          parsed.push({ song: song, session: session, name: name });
          names[name] = true;
        }
      }
      if (!parsed.length) {
        showToast("유효한 데이터가 없습니다.");
        return;
      }
      db.parsedData = parsed;
      db.members = Object.keys(names).sort(function (a, b) {
        return a.localeCompare(b, "ko");
      });
      db.unavailabilities = {};
      HapjuSync.save(db)
        .then(function (result) {
          if (result && result.localOnly) {
            showToast("이 컴퓨터에만 저장됐습니다. Netlify 사이트 주소의 관리자 페이지에서 다시 올려 주세요.");
            return;
          }
          showToast("서버에 명단을 올렸습니다. 휴대폰에서도 같은 주소로 열면 보입니다.");
          showView("menu");
        })
        .catch(function (err) {
          showToast((err && err.message) || "서버 저장에 실패했습니다. 파일을 다시 올려 주세요.");
        });
    };
    reader.readAsArrayBuffer(file);
  }

  function goMember() {
    window.location.href = "index.html";
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("filter-start").value = HapjuMatch.formatDate(state.filterStart);
    $("filter-end").value = HapjuMatch.formatDate(state.filterEnd);
    $("admin-pw").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") checkAuth();
    });
    $("btn-login").addEventListener("click", checkAuth);
    $("btn-results").addEventListener("click", function () {
      HapjuSync.load().then(function (data) {
        db = data;
        showView("results");
      });
    });
    $("btn-upload").addEventListener("click", function () {
      showView("upload");
    });
    $("btn-back-menu").addEventListener("click", function () {
      showView("menu");
    });
    $("btn-back-menu-2").addEventListener("click", function () {
      showView("menu");
    });
    $("btn-member").addEventListener("click", goMember);
    $("btn-change-pin").addEventListener("click", function () {
      var oldPin = $("pin-old").value;
      var newPin = $("pin-new").value.trim();
      if (newPin.length < 4) {
        showToast("새 비밀번호는 4자 이상이어야 합니다.");
        return;
      }
      HapjuSync.changePin(oldPin, newPin)
        .then(function () {
          $("pin-old").value = "";
          $("pin-new").value = "";
          showToast("비밀번호를 바꿨습니다.");
        })
        .catch(function (err) {
          showToast((err && err.message) || "비밀번호를 바꾸지 못했습니다.");
        });
    });
    $("file-upload").addEventListener("change", function (ev) {
      if (ev.target.files && ev.target.files[0]) parseExcel(ev.target.files[0]);
    });
    $("btn-filter").addEventListener("click", function () {
      var st = $("filter-start").value;
      var en = $("filter-end").value;
      if (!st || !en) return;
      var a = st.split("-");
      var b = en.split("-");
      state.filterStart = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]), 12, 0, 0);
      state.filterEnd = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]), 12, 0, 0);
      renderResults();
    });
    $("song-tabs").addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-song]");
      if (!btn) return;
      state.selectedSong = btn.getAttribute("data-song");
      renderResults();
    });
  });
})();
