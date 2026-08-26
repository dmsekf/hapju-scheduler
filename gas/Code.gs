function doGet(e) {
  e = e || { parameter: {} };

  if (e.parameter.action === "get") {
    var raw = getServerDataChunked() || "{}";
    if (e.parameter.callback) {
      var payload = raw && (raw.charAt(0) === "{" || raw.charAt(0) === "[") ? raw : JSON.stringify(raw);
      return ContentService.createTextOutput(e.parameter.callback + "(" + payload + ");").setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
    }
    return ContentService.createTextOutput(raw).setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.mode === "admin") {
    var template = HtmlService.createTemplateFromFile("Admin");
    var savedPw = PropertiesService.getScriptProperties().getProperty("ADMIN_PW");
    template.adminPassword = savedPw ? savedPw : "1234";
    return template
      .evaluate()
      .setTitle("관리자 - 합주 스케줄러")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, viewport-fit=cover")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("합주 스케줄러")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, viewport-fit=cover")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
    if (body.type === "saveAll" && body.data) {
      saveServerDataChunked(typeof body.data === "string" ? body.data : JSON.stringify(body.data));
    } else if (typeof body.parsedData !== "undefined") {
      saveServerDataChunked(JSON.stringify(body));
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(
      ContentService.MimeType.JSON
    );
  }
}

function getServerDataChunked() {
  var props = PropertiesService.getScriptProperties();
  var chunks = parseInt(props.getProperty("BAND_DATA_CHUNKS") || "0", 10);
  if (chunks === 0) return null;
  var data = "";
  for (var i = 0; i < chunks; i++) {
    data += props.getProperty("BAND_DATA_" + i) || "";
  }
  return data;
}

function saveServerDataChunked(dataString) {
  var props = PropertiesService.getScriptProperties();
  var chunkSize = 8000;
  var chunks = Math.ceil(dataString.length / chunkSize);
  var oldChunks = parseInt(props.getProperty("BAND_DATA_CHUNKS") || "0", 10);
  for (var j = chunks; j < oldChunks; j++) {
    props.deleteProperty("BAND_DATA_" + j);
  }
  props.setProperty("BAND_DATA_CHUNKS", chunks.toString());
  for (var i = 0; i < chunks; i++) {
    props.setProperty("BAND_DATA_" + i, dataString.substring(i * chunkSize, (i + 1) * chunkSize));
  }
  return true;
}
