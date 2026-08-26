(function (global) {
  var START = (global.HAPJU_CONFIG && global.HAPJU_CONFIG.startHour) || 10;
  var END = (global.HAPJU_CONFIG && global.HAPJU_CONFIG.endHour) || 23;
  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function getDayName(d) {
    return DAYS[d.getDay()];
  }

  function isVocal(session) {
    var s = String(session || "").toLowerCase();
    return s.indexOf("보컬") >= 0 || s.indexOf("vocal") >= 0;
  }

  function findCommonTimesGrouped(mList, unavailabilities, startDate, endDate) {
    if (!mList.length) return {};
    var start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    var end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    var diff = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    var groups = {};
    var i, j, h;

    for (i = 0; i <= diff; i++) {
      var d = new Date(start);
      d.setDate(d.getDate() + i);
      var ds = formatDate(d);
      var dayHours = [];
      for (h = START; h <= END; h++) {
        var tk = ds + "_" + h;
        var avail = true;
        for (j = 0; j < mList.length; j++) {
          var m = mList[j];
          if (unavailabilities[m] && unavailabilities[m][tk] !== undefined) {
            avail = false;
            break;
          }
        }
        if (avail) dayHours.push(h);
      }
      if (dayHours.length) {
        var merged = [];
        var s = dayHours[0];
        var e = dayHours[0];
        for (j = 1; j < dayHours.length; j++) {
          if (dayHours[j] === e + 1) e = dayHours[j];
          else {
            merged.push(s + ":00 ~ " + (e + 1) + ":00");
            s = dayHours[j];
            e = dayHours[j];
          }
        }
        merged.push(s + ":00 ~ " + (e + 1) + ":00");
        groups[d.getMonth() + 1 + "/" + d.getDate() + " (" + getDayName(d) + ")"] = merged;
      }
    }
    return groups;
  }

  function songMembers(parsedData, song) {
    return parsedData.filter(function (row) {
      return row.song === song;
    });
  }

  function uniqueNames(rows) {
    var set = [];
    rows.forEach(function (row) {
      if (row.name && set.indexOf(row.name) < 0) set.push(row.name);
    });
    return set;
  }

  global.HapjuMatch = {
    formatDate: formatDate,
    getDayName: getDayName,
    isVocal: isVocal,
    findCommonTimesGrouped: findCommonTimesGrouped,
    songMembers: songMembers,
    uniqueNames: uniqueNames,
    songList: function (parsedData) {
      var songs = [];
      (parsedData || []).forEach(function (row) {
        if (row.song && songs.indexOf(row.song) < 0) songs.push(row.song);
      });
      return songs;
    },
  };
})(window);
