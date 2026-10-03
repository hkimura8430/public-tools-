(function () {
  "use strict";

  // ---------- category model ----------
  var CATS = {
    fixed:   { label: "固定生活費",   color: "var(--series-fixed)", cssVar: "--series-fixed",
               subs: ["食費","日用品","水道・光熱","通信","サブスク","その他固定費"] },
    fun:     { label: "娯楽・お出かけ", color: "var(--series-fun)",   cssVar: "--series-fun",
               subs: ["外食","旅行","交際費","趣味・その他娯楽"] },
    unknown: { label: "要確認",       color: "var(--series-other)", cssVar: "--series-other",
               subs: ["未分類"] }
  };
  var CAT_ORDER = ["fixed", "fun", "unknown"];

  var DEFAULT_RULES = [
    {keyword:"ガス", category:"fixed", subcategory:"水道・光熱"},
    {keyword:"水道", category:"fixed", subcategory:"水道・光熱"},
    {keyword:"電気", category:"fixed", subcategory:"水道・光熱"},
    {keyword:"ソフトバンク", category:"fixed", subcategory:"通信"},
    {keyword:"ドコモ", category:"fixed", subcategory:"通信"},
    {keyword:"au", category:"fixed", subcategory:"通信"},
    {keyword:"楽天モバイル", category:"fixed", subcategory:"通信"},
    {keyword:"スーパー", category:"fixed", subcategory:"食費"},
    {keyword:"イオン", category:"fixed", subcategory:"食費"},
    {keyword:"西友", category:"fixed", subcategory:"食費"},
    {keyword:"ライフ", category:"fixed", subcategory:"食費"},
    {keyword:"マルエツ", category:"fixed", subcategory:"食費"},
    {keyword:"ドンキホーテ", category:"fixed", subcategory:"日用品"},
    {keyword:"AMAZON", category:"fixed", subcategory:"日用品"},
    {keyword:"Netflix", category:"fixed", subcategory:"サブスク"},
    {keyword:"Spotify", category:"fixed", subcategory:"サブスク"},
    {keyword:"日経", category:"fixed", subcategory:"サブスク"},
    {keyword:"Trip.com", category:"fun", subcategory:"旅行"},
    {keyword:"Expedia", category:"fun", subcategory:"旅行"},
    {keyword:"じゃらん", category:"fun", subcategory:"旅行"},
    {keyword:"楽天トラベル", category:"fun", subcategory:"旅行"},
    {keyword:"ANA", category:"fun", subcategory:"旅行"},
    {keyword:"JAL", category:"fun", subcategory:"旅行"},
    {keyword:"Klook", category:"fun", subcategory:"旅行"},
    {keyword:"スターバックス", category:"fun", subcategory:"外食"},
    {keyword:"食べログ", category:"fun", subcategory:"外食"},
    {keyword:"ぐるなび", category:"fun", subcategory:"外食"}
  ];

  var SAMPLE_CSV = "日付,内容,金額\n" +
    "2026/06/03,スーパーライフ,4200\n" +
    "2026/06/05,トウキヨウガス,5300\n" +
    "2026/06/06,東京都水道局,2800\n" +
    "2026/06/08,ソフトバンクビービー,5000\n" +
    "2026/06/12,スターバックス,1200\n" +
    "2026/06/15,Trip.comホテル予約,32000\n" +
    "2026/06/20,AMAZON.CO.JP,3400\n" +
    "2026/06/24,ナゾノテンポ123,8000\n" +
    "2026/07/02,スーパーライフ,4600\n" +
    "2026/07/05,トウキヨウガス,4900\n" +
    "2026/07/10,じゃらんパック,45000\n" +
    "2026/07/18,ドンキホーテ,2600\n" +
    "2026/07/22,フメイナテンポ,6000\n";

  // ---------- storage ----------
  var LS_RULES = "expense-tool-rules-v1";
  var LS_THEME = "expense-tool-theme";

  function loadRules() {
    try {
      var raw = localStorage.getItem(LS_RULES);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed.map(withId);
      }
    } catch (e) {}
    return DEFAULT_RULES.map(withId);
  }
  var ruleSeq = 1;
  function withId(r) { return { id: "r" + (ruleSeq++), keyword: r.keyword, category: r.category, subcategory: r.subcategory }; }
  function saveRules() { localStorage.setItem(LS_RULES, JSON.stringify(rules.map(function (r) { return { keyword: r.keyword, category: r.category, subcategory: r.subcategory }; }))); }

  var rules = loadRules();
  var transactions = [];
  var txSeq = 1;

  // ---------- theme ----------
  var htmlEl = document.documentElement;
  function applyTheme(t) {
    if (t) htmlEl.setAttribute("data-theme", t);
    else htmlEl.removeAttribute("data-theme");
  }
  applyTheme(localStorage.getItem(LS_THEME));
  document.getElementById("theme-toggle").addEventListener("click", function () {
    var cur = htmlEl.getAttribute("data-theme");
    var next = cur === "dark" ? "light" : (cur === "light" ? null : "dark");
    applyTheme(next);
    if (next) localStorage.setItem(LS_THEME, next); else localStorage.removeItem(LS_THEME);
  });

  // ---------- CSV parsing ----------
  function detectDelimiter(text) {
    var firstLine = text.split(/\r?\n/, 1)[0] || "";
    var commaCount = (firstLine.match(/,/g) || []).length;
    var tabCount = (firstLine.match(/\t/g) || []).length;
    return tabCount > commaCount ? "\t" : ",";
  }
  function parseCSV(text, delimiter) {
    var rowsOut = [], row = [], field = "", inQuotes = false, i = 0, len = text.length;
    while (i < len) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === delimiter) { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rowsOut.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rowsOut.push(row); }
    return rowsOut.filter(function (r) { return !(r.length === 1 && r[0].trim() === ""); });
  }

  // ---------- date/amount normalization (shared by CSV columns and PDF lines) ----------
  // Full-width digits/slash/hyphen/space -> half-width, so "２０２６／０５／２７"
  // and "26/05/27" hit the same regexes.
  function normalizeText(s) {
    if (!s) return s;
    return String(s)
      .replace(/[０-９]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/／/g, "/")
      .replace(/－/g, "-")
      .replace(/　/g, " ");
  }
  var ERA_BASE_YEAR = { "令和": 2019, "平成": 1989, "昭和": 1926, "大正": 1912, "明治": 1868 };
  var ERA_DATE_RE = /(令和|平成|昭和|大正|明治)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日?/;
  function matchEraDate(text) {
    var m = text.match(ERA_DATE_RE);
    if (!m) return null;
    var base = ERA_BASE_YEAR[m[1]];
    if (!base) return null;
    var n = m[2] === "元" ? 1 : +m[2];
    return { match: m[0], year: base + n - 1, month: +m[3], day: +m[4] };
  }

  function detectColumns(rows) {
    var numCols = 0;
    rows.forEach(function (r) { if (r.length > numCols) numCols = r.length; });
    var stats = [];
    for (var c = 0; c < numCols; c++) {
      var dateHits = 0, amountHits = 0, lenSum = 0, n = 0;
      rows.forEach(function (r) {
        var v = (r[c] || "").trim();
        if (!v) return;
        n++;
        if (parseDateVal(v)) dateHits++;
        if (parseAmountVal(v) !== null) amountHits++;
        lenSum += v.length;
      });
      stats.push({ c: c, dateHits: dateHits, amountHits: amountHits, avgLen: n ? lenSum / n : 0 });
    }
    var dateCol = null, best = 0;
    stats.forEach(function (s) { if (s.dateHits > best) { best = s.dateHits; dateCol = s.c; } });
    var amountCol = null; best = 0;
    stats.forEach(function (s) { if (s.c !== dateCol && s.amountHits > best) { best = s.amountHits; amountCol = s.c; } });
    var descCol = null; best = -1;
    stats.forEach(function (s) { if (s.c !== dateCol && s.c !== amountCol && s.avgLen > best) { best = s.avgLen; descCol = s.c; } });
    if (descCol === null) {
      stats.forEach(function (s) { if (descCol === null && s.c !== dateCol && s.c !== amountCol) descCol = s.c; });
    }
    return { dateCol: dateCol, amountCol: amountCol, descCol: descCol, numCols: numCols };
  }

  function parseDateVal(v) {
    if (!v) return null;
    var s = normalizeText(String(v)).trim();
    if (!s) return null;
    var era = matchEraDate(s);
    if (era) return { year: era.year, month: era.month, key: era.year + "-" + String(era.month).padStart(2, "0") };
    var m = s.match(/(\d{4})[\/\-.年](\d{1,2})(?:[\/\-.月](\d{1,2})日?)?/);
    if (m) {
      var y = +m[1], mo = +m[2];
      if (mo >= 1 && mo <= 12) return { year: y, month: mo, key: y + "-" + String(mo).padStart(2, "0") };
    }
    // 2-digit era-less year, e.g. "26/05/27" or "26-05-27" (whole-field match only,
    // to avoid mistaking an unrelated number pair for a date).
    var m2 = s.match(/^(\d{2})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?$/);
    if (m2) {
      var y2 = 2000 + (+m2[1]), mo2 = +m2[2];
      if (mo2 >= 1 && mo2 <= 12) return { year: y2, month: mo2, key: y2 + "-" + String(mo2).padStart(2, "0") };
    }
    return null;
  }

  // ---------- PDF extraction ----------
  // Full date with a 4-digit year: 2026/05/27, 2026-05-27, 2026年5月27日 ...
  var DATE_LINE_RE = /(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?/;
  // "年/月/日" split into three separate table cells at the START of a line,
  // 2-digit era-less year (common in Japanese card statements, e.g. "26 05 27"):
  var DATE_LEADING_YMD_RE = /^\s*(\d{2})[\s　]+(\d{1,2})[\s　]+(\d{1,2})(?=[\s　])/;
  // Same idea but joined with a symbol instead of whitespace: "26/05/27", "26-05-27".
  var DATE_LEADING_YMD_SEP_RE = /^\s*(\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?=\s|$)/;
  var AMOUNT_TOKEN_RE = /[¥￥]?-?[\d,]{2,}(?:\.\d+)?\s*円?/g;
  var NON_TX_RE = /(合計|小計|残高|残額|ご利用可能|可能枠|変更可能|繰越|お支払[いｉ]?金額|締切|支払日|支払コース|手数料率|実質年率|融資利率|ポイント|獲得|ページ目|明細作成日|登録番号|口座番号|口座名義|金融機関|支店名|財務局)/;
  var MAX_TX_LINE_LEN = 70;

  function findDateInLine(text) {
    var era = matchEraDate(text);
    if (era) return era;
    var m = text.match(DATE_LINE_RE);
    if (m) return { match: m[0], year: +m[1], month: +m[2], day: +m[3] };
    // The 2-digit-year variants are only trusted near the very start of the
    // line — a bare "26/05/27"-shaped token deep in running text is too easy
    // to confuse with something else (a phone number, a reference code).
    var m2 = text.match(DATE_LEADING_YMD_RE) || text.match(DATE_LEADING_YMD_SEP_RE);
    if (m2) {
      var yy = +m2[1], mo = +m2[2], da = +m2[3];
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        return { match: m2[0], year: 2000 + yy, month: mo, day: da };
      }
    }
    return null;
  }
  function findLastAmountToken(text) {
    var matches = text.match(AMOUNT_TOKEN_RE);
    if (!matches || !matches.length) return null;
    // Drop single-digit-only noise (e.g. "1回" counters already excluded by
    // the {2,} length requirement) and pick the right-most genuine amount.
    return matches[matches.length - 1];
  }
  function looksLikeNonTransaction(line) {
    if (NON_TX_RE.test(line)) return true;
    if (/[%％]/.test(line)) return true; // fee-rate / disclaimer sentences, never a real amount
    if (line.length > MAX_TX_LINE_LEN) return true; // long prose, not a table row
    return false;
  }

  async function extractPdfLines(file) {
    if (!window.pdfjsLib) throw new Error("PDF読み込みライブラリを読み込めませんでした。");
    try {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.js";
      }
    } catch (e) { /* older/newer pdf.js builds may expose this differently; ignore */ }
    var buf = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
    var lines = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var groups = new Map();
      content.items.forEach(function (item) {
        var y = Math.round(item.transform[5]);
        var placed = false;
        groups.forEach(function (arr, key) {
          if (!placed && Math.abs(key - y) <= 3) { arr.push({ x: item.transform[4], text: item.str }); placed = true; }
        });
        if (!placed) groups.set(y, [{ x: item.transform[4], text: item.str }]);
      });
      var ys = Array.from(groups.keys()).sort(function (a, b) { return b - a; });
      ys.forEach(function (y) {
        var sorted = groups.get(y).slice().sort(function (a, b) { return a.x - b.x; });
        var lineText = normalizeText(sorted.map(function (i) { return i.text; }).join(" ")).replace(/\s+/g, " ").trim();
        if (lineText) lines.push(lineText);
      });
    }
    return lines;
  }

  // Many statement tables repeat the same amount in an earlier column
  // (e.g. "ご利用金額" vs "今回のお支払金額") and append a "N回" payment-count
  // cell. Strip that noise so the description reads as a clean store name.
  function stripDuplicateAmount(text, amountClean) {
    var idx = text.indexOf(amountClean);
    if (idx === -1) return text;
    var before = idx === 0 ? " " : text.charAt(idx - 1);
    var afterIdx = idx + amountClean.length;
    if (text.charAt(afterIdx) === "円") afterIdx += 1;
    var after = afterIdx >= text.length ? " " : text.charAt(afterIdx);
    if (/\s/.test(before) && /\s/.test(after)) {
      return text.slice(0, idx) + " " + text.slice(afterIdx);
    }
    return text;
  }
  function finalizeDesc(text, amountClean) {
    var t = text.replace(/[|｜]/g, " "); // table border characters (esp. OCR misreads)
    t = stripDuplicateAmount(t, amountClean);
    t = t.replace(/(^|\s)\d+回(?=\s|$)/g, " "); // "N回" support-count column
    t = t.replace(/(^|\s)\d(?=\s|$)/g, " ");    // lone single-digit count column
    t = t.replace(/\s+/g, " ").trim();
    return t || "(内容不明)";
  }
  // OCR-only: strip a leading run of digits/whitespace/border-noise characters
  // left over from the "年 月 日" columns, which OCR often garbles into stray
  // "1"/"i"/"I"/"l" characters bleeding in from the adjacent divider line.
  // Not applied to the PDF text-layer path, where a real store name could
  // legitimately start with a digit (e.g. "711", "7net").
  function stripOcrLeadingNoise(t) {
    var s = t.replace(/^[\d\s iIlｌ\[\]（）().,\-一ー]{2,20}/, "").trim();
    return s || t;
  }

  // Strict pass: a transaction line carries its own date AND amount.
  function extractRowsStrict(lines) {
    var rows = [];
    lines.forEach(function (line) {
      if (looksLikeNonTransaction(line)) return;
      var d = findDateInLine(line);
      if (!d) return;
      var dateIdx = line.indexOf(d.match);
      var rest = line.slice(0, dateIdx) + " " + line.slice(dateIdx + d.match.length);
      var amtStr = findLastAmountToken(rest);
      if (!amtStr) return;
      var amtIdx = rest.lastIndexOf(amtStr);
      var amountClean = amtStr.replace(/[¥￥円\s]/g, "");
      var desc = finalizeDesc((rest.slice(0, amtIdx) + " " + rest.slice(amtIdx + amtStr.length)).replace(/\s+/g, " ").trim(), amountClean);
      rows.push({ date: d.year + "/" + d.month + "/" + d.day, desc: desc, amount: amountClean });
    });
    return rows;
  }

  // Lenient pass: many statements print the date once and list several
  // transaction lines (amount only) below it — carry the last seen date forward.
  function extractRowsLenient(lines) {
    var rows = [];
    var lastDate = null;
    lines.forEach(function (line) {
      if (looksLikeNonTransaction(line)) return;
      var d = findDateInLine(line);
      var workLine = line;
      if (d) {
        lastDate = d;
        var dateIdx = line.indexOf(d.match);
        workLine = line.slice(0, dateIdx) + " " + line.slice(dateIdx + d.match.length);
      }
      if (!lastDate) return;
      var amtStr = findLastAmountToken(workLine);
      if (!amtStr) return;
      var amtIdx = workLine.lastIndexOf(amtStr);
      var amountClean = amtStr.replace(/[¥￥円\s]/g, "");
      var desc = finalizeDesc((workLine.slice(0, amtIdx) + " " + workLine.slice(amtIdx + amtStr.length)).replace(/\s+/g, " ").trim(), amountClean);
      if (desc === "(内容不明)") return;
      rows.push({ date: lastDate.year + "/" + lastDate.month + "/" + lastDate.day, desc: desc, amount: amountClean });
    });
    return rows;
  }

  function rowsToCsvText(rows) {
    var out = ["日付,内容,金額"];
    rows.forEach(function (r) {
      var descEsc = '"' + r.desc.replace(/"/g, '""') + '"';
      // The amount keeps its thousands-separating comma (e.g. "21,800") so
      // it must be quoted like any other comma-containing CSV field --
      // otherwise the comma is read as a column delimiter and the amount
      // gets silently truncated to the part before it when re-parsed.
      var amountEsc = /[,"\n\r]/.test(r.amount) ? '"' + String(r.amount).replace(/"/g, '""') + '"' : r.amount;
      out.push([r.date, descEsc, amountEsc].join(","));
    });
    return out.join("\n");
  }

  function pdfLinesToCsv(lines) {
    var strict = extractRowsStrict(lines);
    if (strict.length) return { rows: strict, csvText: rowsToCsvText(strict), lenient: false };
    var lenient = extractRowsLenient(lines);
    return { rows: lenient, csvText: rowsToCsvText(lenient), lenient: true };
  }

  async function handlePdfFile(file) {
    var status = document.getElementById("parse-status");
    var classifyBtn = document.getElementById("classify-btn");
    var fileInput = document.getElementById("file-input");
    var ocrOfferEl = document.getElementById("ocr-offer");
    if (ocrOfferEl) ocrOfferEl.style.display = "none";
    status.textContent = "PDFを解析中...";
    classifyBtn.disabled = true;
    try {
      var lines = await extractPdfLines(file);
      fileInput.value = ""; // always clear so a later click never re-reads the PDF binary as text
      if (!lines.length) {
        status.textContent = "⚠ このPDFからテキストを抽出できませんでした。文字情報を持たないPDF（文字が図形として描画されているPDF等）、スキャン画像のPDF、またはパスワード保護されたPDFの可能性があります。下の「画像認識(OCR)で試す」、またはCSVでの入力をお試しください。";
        lastInputWasOcr = false;
        showOcrOffer(file);
        return;
      }
      var result = pdfLinesToCsv(lines);
      if (!result.rows.length) {
        lastInputWasOcr = false;
        document.getElementById("paste-area").value = lines.join("\n");
        analyzeInput();
        status.textContent = "⚠ PDFからテキスト(" + lines.length + "行)は抽出できましたが、「日付」と「金額」の並びを自動検出できませんでした。下の貼り付け欄に抽出テキストを入れたので、列の選択と内容を確認するか「日付,内容,金額」の形に手直ししてから分類してください。";
        return;
      }
      lastInputWasOcr = false;
      document.getElementById("paste-area").value = result.csvText;
      analyzeInput();
      status.textContent = "PDFから " + result.rows.length + " 件の明細候補を抽出しました（全" + lines.length + "行中）" +
        (result.lenient ? "。※日付が省略されている行は直前の日付を引き継いで推定しているため、内容を必ずご確認ください。" : "。内容を確認してから「分類する」を押してください。");
    } catch (err) {
      fileInput.value = "";
      status.textContent = "PDFの解析に失敗しました: " + (err && err.message ? err.message : err);
    } finally {
      classifyBtn.disabled = false;
    }
  }

  // ---------- OCR (fallback for PDFs with no extractable text layer) ----------
  // Lazy-loaded: only fetched when the user explicitly opts in, so the common
  // case (CSV, or a PDF with a real text layer) never pays this ~5.6MB cost.
  var lastInputWasOcr = false;
  var tesseractLoadPromise = null;
  function loadTesseractScript() {
    if (window.Tesseract) return Promise.resolve();
    if (tesseractLoadPromise) return tesseractLoadPromise;
    tesseractLoadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "./tesseract.min.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("OCRライブラリ(tesseract.min.js)を読み込めませんでした。")); };
      document.head.appendChild(s);
    });
    return tesseractLoadPromise;
  }

  function showOcrOffer(file) {
    var offer = document.getElementById("ocr-offer");
    var btn = document.getElementById("ocr-try-btn");
    if (!offer || !btn) {
      var status = document.getElementById("parse-status");
      if (status) status.textContent += "（OCRボタンの表示に失敗しました。ページを再読み込みしてから、もう一度お試しください）";
      return;
    }
    offer.style.display = "block";
    // Replace the button to drop any previously bound listener (avoids
    // double-firing if the user tries OCR more than once in a session).
    var freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);
    freshBtn.addEventListener("click", function () { runOcr(file); });
  }

  // Thresholds the rendered page to pure black/white. Removes the alternating
  // row-shading common in statement tables, which otherwise confuses OCR
  // binarization and segmentation far more than the grid lines themselves do.
  function preprocessCanvasForOcr(ctx, w, h) {
    var imgData = ctx.getImageData(0, 0, w, h);
    var d = imgData.data;
    var THRESH = 150;
    for (var i = 0; i < d.length; i += 4) {
      var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      var v = lum < THRESH ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // OCR reliably renders a thousands-separating comma as a period in this
  // table's font/resolution (e.g. "21,800" -> "21.800"). Yen amounts never
  // have a genuine fractional part, so any "<digits>.<exactly 3 digits>" is
  // almost certainly a misread comma, not a decimal point.
  function fixOcrThousands(s) {
    return s.replace(/(\d)\.(\d{3})(?=\D|$)/g, "$1,$2");
  }

  // Fallback OCR extraction: per-row dates in a cramped bordered table are
  // frequently corrupted beyond what any fixed pattern can parse reliably
  // (stray characters from the column divider bleed into the digits
  // unpredictably). Store name + amount survive OCR far better than the
  // date does, so this pass deliberately drops the per-row date rather than
  // risk assigning a wrong one — every row lands in the same "date unknown"
  // bucket the rest of the app already handles (counted in totals, excluded
  // from the monthly chart) instead of corrupting the monthly breakdown.
  function extractRowsAmountOnly(rawLines) {
    var rows = [];
    rawLines.forEach(function (raw) {
      var line = fixOcrThousands(normalizeText(raw).replace(/\s+/g, " ").trim());
      if (looksLikeNonTransaction(line)) return;
      var amtStr = findLastAmountToken(line);
      if (!amtStr) return;
      var amtIdx = line.lastIndexOf(amtStr);
      var amountClean = amtStr.replace(/[¥￥円\s]/g, "");
      var amtNum = parseFloat(amountClean.replace(/,/g, ""));
      if (!amtNum || amtNum < 10) return; // guards against stray short numeric noise
      var desc = stripOcrLeadingNoise(finalizeDesc(line.slice(0, amtIdx) + " " + line.slice(amtIdx + amtStr.length), amountClean));
      if (desc === "(内容不明)") return;
      rows.push({ date: "", desc: desc, amount: amountClean });
    });
    return rows;
  }

  // Three-tier OCR extraction: prefer a real per-row date when OCR was clean
  // enough to produce one reliably (>=3 matches, to avoid trusting a single
  // coincidental match), then fall back to the date-less amount-only pass.
  function ocrLinesToCsv(lines) {
    var normalized = lines.map(fixOcrThousands);
    var strict = extractRowsStrict(normalized);
    if (strict.length >= 3) return { rows: strict, csvText: rowsToCsvText(strict), mode: "strict" };
    var lenient = extractRowsLenient(normalized);
    if (lenient.length >= 3) return { rows: lenient, csvText: rowsToCsvText(lenient), mode: "lenient" };
    var amountOnly = extractRowsAmountOnly(lines);
    return { rows: amountOnly, csvText: rowsToCsvText(amountOnly), mode: "amount-only" };
  }

  async function runOcr(file) {
    var status = document.getElementById("parse-status");
    var progressEl = document.getElementById("ocr-progress");
    var classifyBtn = document.getElementById("classify-btn");
    var tryBtn = document.getElementById("ocr-try-btn");
    tryBtn.disabled = true;
    classifyBtn.disabled = true;
    var worker = null;
    try {
      status.textContent = "OCRライブラリを準備中...（初回は約5.6MBのダウンロードが発生します）";
      await loadTesseractScript();
      if (!window.pdfjsLib) throw new Error("PDF読み込みライブラリが利用できません。");

      var buf = await file.arrayBuffer();
      var pdf = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;

      progressEl.textContent = "OCRエンジンを初期化中...";
      worker = await Tesseract.createWorker("jpn", 1, {
        workerPath: "./tesseract-worker.min.js",
        corePath: "./tesseract-core-lstm.wasm.js",
        langPath: "./",
        gzip: true,
        cacheMethod: "none",
        logger: function (m) {
          if (m && m.status) {
            var pct = typeof m.progress === "number" ? " (" + Math.round(m.progress * 100) + "%)" : "";
            progressEl.textContent = "OCR: " + m.status + pct;
          }
        }
      });

      // Each page's extraction cascade (strict -> lenient -> amount-only) is
      // decided INDEPENDENTLY per page, then the resulting rows are merged.
      // A combined "all pages at once" judgment would let a cleaner-but-
      // irrelevant page (e.g. a points/credit-limit summary page, which OCRs
      // more accurately because it has no shaded table rows) hit the >=3
      // threshold first and pre-empt the real transaction page's fallback to
      // amount-only mode — silently dropping the actual transactions.
      var allLines = [];
      var allRows = [];
      var anyAmountOnly = false;
      for (var p = 1; p <= pdf.numPages; p++) {
        progressEl.textContent = "ページ " + p + "/" + pdf.numPages + " を画像化しています...";
        var page = await pdf.getPage(p);
        var viewport = page.getViewport({ scale: 4.0 });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        preprocessCanvasForOcr(ctx, canvas.width, canvas.height);

        progressEl.textContent = "ページ " + p + "/" + pdf.numPages + " を認識中...";
        var result = await worker.recognize(canvas);
        var pageLines = (result.data.lines || [])
          .map(function (l) { return normalizeText(l.text || "").replace(/\s+/g, " ").trim(); })
          .filter(Boolean);
        allLines = allLines.concat(pageLines);
        var pageResult = ocrLinesToCsv(pageLines);
        allRows = allRows.concat(pageResult.rows);
        if (pageResult.mode === "amount-only") anyAmountOnly = true;
      }
      await worker.terminate();
      worker = null;
      progressEl.textContent = "";

      if (!allLines.length) {
        status.textContent = "⚠ OCRでも文字を認識できませんでした。お手数ですがCSVでの入力をお試しください。";
        return;
      }
      if (!allRows.length) {
        lastInputWasOcr = false;
        document.getElementById("paste-area").value = allLines.join("\n");
        analyzeInput();
        status.textContent = "⚠ OCRでテキスト(" + allLines.length + "行)は認識できましたが、取引らしき行を自動検出できませんでした。内容を確認し、手直ししてから分類してください（画像認識のため誤読の可能性があります）。";
        return;
      }
      lastInputWasOcr = true;
      document.getElementById("paste-area").value = rowsToCsvText(allRows);
      analyzeInput();
      status.textContent = "⚠ OCRで " + allRows.length + " 件の明細候補を認識しました。" +
        (anyAmountOnly ? "日付の読み取りが不安定だったページがあり、該当行の日付は空欄にしています（手動で補ってください）。" : "") +
        "画像認識のため数字を誤認識している場合があります。分類する前に、必ず金額を元のPDFと見比べてください。";
      document.getElementById("ocr-offer").style.display = "none";
    } catch (err) {
      status.textContent = "OCR処理に失敗しました: " + (err && err.message ? err.message : err);
    } finally {
      if (worker) { try { await worker.terminate(); } catch (e) {} }
      tryBtn.disabled = false;
      classifyBtn.disabled = false;
    }
  }

  function parseAmountVal(v) {
    if (v === null || v === undefined) return null;
    var s = normalizeText(String(v)).trim();
    if (!s) return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[¥￥,\s円]/g, "");
    if (/^-/.test(s)) { neg = true; s = s.slice(1); }
    else if (/^\+/.test(s)) { s = s.slice(1); }
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = parseFloat(s);
    return neg ? -n : n;
  }

  // ---------- classification ----------
  function classify(desc) {
    var d = (desc || "").toLowerCase();
    var sorted = rules.slice().sort(function (a, b) { return b.keyword.length - a.keyword.length; });
    for (var i = 0; i < sorted.length; i++) {
      var r = sorted[i];
      if (r.keyword && d.indexOf(r.keyword.toLowerCase()) !== -1) {
        return { category: r.category, subcategory: r.subcategory };
      }
    }
    return { category: "unknown", subcategory: "未分類" };
  }
  function reclassifyAll() {
    transactions.forEach(function (t) {
      if (t.manual) return;
      var r = classify(t.description);
      t.category = r.category;
      t.subcategory = r.subcategory;
    });
  }

  // ---------- format helpers ----------
  function yen(n) { return "¥" + Math.round(n).toLocaleString("ja-JP"); }
  function pct(n) { return (n * 100).toFixed(1) + "%"; }

  // ---------- rows -> transactions ----------
  var lastRawRows = [];
  function rebuildColumnSelects(headerRow, hasHeader, guess) {
    ["col-date", "col-desc", "col-amount"].forEach(function (id, idx) {
      var sel = document.getElementById(id);
      sel.innerHTML = "";
      var count = guess.numCols;
      for (var c = 0; c < count; c++) {
        var label = hasHeader && headerRow[c] ? headerRow[c] : ("列" + (c + 1));
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = label;
        sel.appendChild(opt);
      }
    });
    if (guess.dateCol !== null) document.getElementById("col-date").value = guess.dateCol;
    if (guess.descCol !== null) document.getElementById("col-desc").value = guess.descCol;
    if (guess.amountCol !== null) document.getElementById("col-amount").value = guess.amountCol;
  }

  function getInputText(cb) {
    var pasted = document.getElementById("paste-area").value;
    if (pasted && pasted.trim()) { cb(pasted); return; }
    var file = document.getElementById("file-input").files[0];
    if (file) {
      var enc = document.getElementById("encoding-select").value;
      var reader = new FileReader();
      reader.onload = function (e) { cb(e.target.result); };
      reader.readAsText(file, enc);
      return;
    }
    cb("");
  }

  function analyzeInput() {
    getInputText(function (text) {
      var status = document.getElementById("parse-status");
      if (!text || !text.trim()) { status.textContent = "入力データがありません"; return; }
      var delim = detectDelimiter(text);
      var rowsAll = parseCSV(text, delim);
      if (!rowsAll.length) { status.textContent = "データを読み取れませんでした"; return; }
      lastRawRows = rowsAll;
      var hasHeader = document.getElementById("has-header").checked;
      var dataRows = hasHeader ? rowsAll.slice(1) : rowsAll;
      var guess = detectColumns(dataRows.slice(0, 60));
      rebuildColumnSelects(rowsAll[0], hasHeader, guess);
      status.textContent = rowsAll.length + " 行読み込みました（列は必要に応じて選び直してください）";
    });
  }

  function runClassification() {
    getInputText(function (text) {
      var status = document.getElementById("parse-status");
      if (!text || !text.trim()) { status.textContent = "入力データがありません"; return; }
      var delim = detectDelimiter(text);
      var rowsAll = parseCSV(text, delim);
      if (!rowsAll.length) { status.textContent = "データを読み取れませんでした"; return; }
      var hasHeader = document.getElementById("has-header").checked;
      var dataRows = hasHeader ? rowsAll.slice(1) : rowsAll;
      var dateCol = +document.getElementById("col-date").value;
      var descCol = +document.getElementById("col-desc").value;
      var amountCol = +document.getElementById("col-amount").value;

      var newTx = [];
      var badAmount = 0, badDate = 0;
      dataRows.forEach(function (r) {
        var descRaw = (r[descCol] || "").trim();
        var amountRaw = (r[amountCol] || "").trim();
        var dateRaw = (r[dateCol] || "").trim();
        if (!descRaw && !amountRaw && !dateRaw) return;
        var amount = parseAmountVal(amountRaw);
        var date = parseDateVal(dateRaw);
        if (amount === null) badAmount++;
        if (!date) badDate++;
        var cls = classify(descRaw);
        newTx.push({
          id: "t" + (txSeq++),
          dateRaw: dateRaw,
          date: date,
          description: descRaw,
          amountRaw: amountRaw,
          amount: amount === null ? 0 : amount,
          amountUnparsed: amount === null,
          category: cls.category,
          subcategory: cls.subcategory,
          manual: false,
          isOcr: lastInputWasOcr
        });
      });
      transactions = newTx;
      status.textContent = transactions.length + " 件を分類しました" +
        (badAmount ? "（⚠金額を読み取れなかった行: " + badAmount + "件）" : "") +
        (badDate ? "（月不明の行: " + badDate + "件）" : "");
      renderAll();
    });
  }

  // ---------- tooltip ----------
  var tooltipEl = document.getElementById("tooltip");
  function showTooltip(evt, rows) {
    tooltipEl.innerHTML = "";
    rows.forEach(function (row) {
      var div = document.createElement("div");
      div.className = "t-row";
      var key = document.createElement("span");
      key.className = "k";
      key.style.color = row.color;
      var val = document.createElement("span");
      val.className = "t-val";
      val.textContent = row.value;
      var lab = document.createElement("span");
      lab.className = "t-label";
      lab.textContent = row.label;
      div.appendChild(key); div.appendChild(val); div.appendChild(lab);
      tooltipEl.appendChild(div);
    });
    tooltipEl.style.display = "block";
    positionTooltip(evt);
  }
  function positionTooltip(evt) {
    var x = evt.clientX, y = evt.clientY;
    if (evt.target && evt.target.getBoundingClientRect && evt.type === "focus") {
      var rect = evt.target.getBoundingClientRect();
      x = rect.left + rect.width / 2; y = rect.top;
    }
    var pad = 14;
    tooltipEl.style.left = Math.min(x + pad, window.innerWidth - 250) + "px";
    tooltipEl.style.top = Math.max(y - 10, 8) + "px";
  }
  function hideTooltip() { tooltipEl.style.display = "none"; }
  function wireTooltip(el, rowsFn) {
    el.addEventListener("mousemove", function (e) { showTooltip(e, rowsFn()); });
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("focus", function (e) { showTooltip(e, rowsFn()); });
    el.addEventListener("blur", hideTooltip);
  }

  // ---------- rendering ----------
  function computeTotals() {
    var totals = { fixed: 0, fun: 0, unknown: 0 };
    var sub = { fixed: {}, fun: {}, unknown: {} };
    var monthly = {}; // key -> {fixed,fun,unknown}
    var minDate = null, maxDate = null;
    transactions.forEach(function (t) {
      totals[t.category] += t.amount;
      sub[t.category][t.subcategory] = (sub[t.category][t.subcategory] || 0) + t.amount;
      if (t.date) {
        if (!monthly[t.date.key]) monthly[t.date.key] = { fixed: 0, fun: 0, unknown: 0 };
        monthly[t.date.key][t.category] += t.amount;
        if (minDate === null || t.date.key < minDate) minDate = t.date.key;
        if (maxDate === null || t.date.key > maxDate) maxDate = t.date.key;
      }
    });
    return { totals: totals, sub: sub, monthly: monthly, minDate: minDate, maxDate: maxDate };
  }

  function renderStatTiles(totals, total) {
    var wrap = document.getElementById("stat-tiles");
    wrap.innerHTML = "";
    var hero = document.createElement("div");
    hero.className = "stat-tile hero";
    hero.innerHTML = '<div class="label">総支出</div><div class="value">' + yen(total) + "</div>";
    wrap.appendChild(hero);
    CAT_ORDER.forEach(function (key) {
      var c = CATS[key];
      var v = totals[key];
      var tile = document.createElement("div");
      tile.className = "stat-tile";
      var share = total ? v / total : 0;
      tile.innerHTML =
        '<div class="label"><span class="swatch" style="background:' + c.color + '"></span>' + c.label + "</div>" +
        '<div class="value">' + yen(v) + "</div>" +
        '<div class="share">全体の ' + pct(share) + "</div>";
      wrap.appendChild(tile);
    });
  }

  function renderComposition(totals, total) {
    var bar = document.getElementById("comp-bar");
    var legend = document.getElementById("comp-legend");
    bar.innerHTML = ""; legend.innerHTML = "";
    CAT_ORDER.forEach(function (key) {
      var c = CATS[key];
      var v = totals[key];
      if (v <= 0) return;
      var share = total ? v / total : 0;
      var seg = document.createElement("div");
      seg.className = "comp-seg";
      seg.style.background = c.color;
      seg.style.flex = "0 0 " + Math.max(share * 100, 0.5) + "%";
      seg.tabIndex = 0;
      wireTooltip(seg, function () { return [{ color: c.color, value: yen(v), label: c.label + "（" + pct(share) + "）" }]; });
      bar.appendChild(seg);

      var li = document.createElement("div");
      li.className = "legend-item";
      var sw = document.createElement("span"); sw.className = "swatch"; sw.style.background = c.color;
      var txt = document.createElement("span"); txt.textContent = c.label;
      var amt = document.createElement("span"); amt.className = "amt"; amt.textContent = yen(v) + "（" + pct(share) + "）";
      li.appendChild(sw); li.appendChild(txt); li.appendChild(amt);
      legend.appendChild(li);
    });
  }

  function renderSubcatChart(sub, total) {
    var container = document.getElementById("subcat-chart");
    container.innerHTML = "";
    var entries = [];
    CAT_ORDER.forEach(function (key) {
      Object.keys(sub[key]).forEach(function (name) {
        var v = sub[key][name];
        if (v > 0) entries.push({ catKey: key, name: name, value: v });
      });
    });
    entries.sort(function (a, b) { return b.value - a.value; });
    var max = entries.length ? entries[0].value : 1;
    entries.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "subcat-row";
      var label = document.createElement("div");
      label.className = "subcat-label";
      label.textContent = e.name;
      label.title = e.name;
      var track = document.createElement("div");
      track.className = "subcat-track";
      var barEl = document.createElement("div");
      barEl.className = "subcat-bar";
      barEl.style.width = Math.max((e.value / max) * 100, 1.5) + "%";
      barEl.style.background = CATS[e.catKey].color;
      barEl.tabIndex = 0;
      var share = total ? e.value / total : 0;
      wireTooltip(barEl, function () {
        return [{ color: CATS[e.catKey].color, value: yen(e.value), label: e.name + "（" + CATS[e.catKey].label + "・" + pct(share) + "）" }];
      });
      track.appendChild(barEl);
      var valEl = document.createElement("div");
      valEl.className = "subcat-value";
      valEl.textContent = yen(e.value);
      row.appendChild(label); row.appendChild(track); row.appendChild(valEl);
      container.appendChild(row);
    });
    if (!entries.length) container.innerHTML = '<div class="hint">データがありません</div>';
  }

  function renderMonthly(monthly, minDate, maxDate) {
    var card = document.getElementById("monthly-card");
    var keys = Object.keys(monthly).sort();
    if (!keys.length) { card.style.display = "none"; return; }
    card.style.display = "block";
    var unknownDateCount = transactions.filter(function (t) { return !t.date; }).length;
    document.getElementById("monthly-note").textContent = unknownDateCount ? ("（年月不明: " + unknownDateCount + "件は含まれません）") : "";

    var legend = document.getElementById("monthly-legend");
    legend.innerHTML = "";
    CAT_ORDER.forEach(function (key) {
      var c = CATS[key];
      var li = document.createElement("div");
      li.className = "legend-item";
      li.innerHTML = '<span class="swatch" style="background:' + c.color + '"></span><span>' + c.label + "</span>";
      legend.appendChild(li);
    });

    var maxTotal = 0;
    keys.forEach(function (k) {
      var m = monthly[k];
      var t = m.fixed + m.fun + m.unknown;
      if (t > maxTotal) maxTotal = t;
    });
    if (maxTotal <= 0) maxTotal = 1;

    var chart = document.getElementById("month-chart");
    chart.innerHTML = "";
    keys.forEach(function (k) {
      var m = monthly[k];
      var wrap = document.createElement("div");
      wrap.className = "month-col-wrap";
      var col = document.createElement("div");
      col.className = "month-col";
      CAT_ORDER.forEach(function (key) {
        var v = m[key];
        if (v <= 0) return;
        var seg = document.createElement("div");
        seg.className = "month-seg";
        seg.style.background = CATS[key].color;
        seg.style.height = Math.max((v / maxTotal) * 150, 2) + "px";
        seg.tabIndex = 0;
        wireTooltip(seg, function () {
          return CAT_ORDER.filter(function (kk) { return m[kk] > 0; }).map(function (kk) {
            return { color: CATS[kk].color, value: yen(m[kk]), label: CATS[kk].label };
          });
        });
        col.appendChild(seg);
      });
      var lab = document.createElement("div");
      lab.className = "month-label";
      lab.textContent = k;
      wrap.appendChild(col); wrap.appendChild(lab);
      chart.appendChild(wrap);
    });
  }

  function renderBreakdownTable(sub, totals, total) {
    var tbody = document.querySelector("#breakdown-table tbody");
    tbody.innerHTML = "";
    CAT_ORDER.forEach(function (key) {
      var c = CATS[key];
      var names = Object.keys(sub[key]).filter(function (n) { return sub[key][n] > 0; }).sort(function (a, b) { return sub[key][b] - sub[key][a]; });
      names.forEach(function (name) {
        var v = sub[key][name];
        var tr = document.createElement("tr");
        var tdCat = document.createElement("td");
        var swatch = document.createElement("span"); swatch.className = "swatch"; swatch.style.background = c.color; swatch.style.marginRight = "6px";
        tdCat.appendChild(swatch);
        tdCat.appendChild(document.createTextNode(c.label));
        var tdSub = document.createElement("td"); tdSub.textContent = name;
        var tdAmt = document.createElement("td"); tdAmt.className = "num"; tdAmt.textContent = yen(v);
        var tdPct = document.createElement("td"); tdPct.className = "num"; tdPct.textContent = total ? pct(v / total) : "-";
        tr.appendChild(tdCat); tr.appendChild(tdSub); tr.appendChild(tdAmt); tr.appendChild(tdPct);
        tbody.appendChild(tr);
      });
    });
  }

  function categoryBadge(key) {
    var span = document.createElement("span");
    span.className = "badge badge-" + key;
    span.textContent = CATS[key].label;
    return span;
  }

  function buildCategorySelect(current) {
    var sel = document.createElement("select");
    CAT_ORDER.forEach(function (key) {
      CATS[key].subs.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = key + "::" + s;
        opt.textContent = CATS[key].label + " / " + s;
        if (key === current.category && s === current.subcategory) opt.selected = true;
        sel.appendChild(opt);
      });
    });
    return sel;
  }

  function renderTransactionsTable() {
    var tbody = document.querySelector("#tx-table tbody");
    tbody.innerHTML = "";
    var q = (document.getElementById("tx-search").value || "").toLowerCase();
    transactions
      .filter(function (t) { return !q || t.description.toLowerCase().indexOf(q) !== -1; })
      .forEach(function (t) {
        var tr = document.createElement("tr");
        var tdDate = document.createElement("td"); tdDate.textContent = t.date ? t.date.year + "/" + t.date.month : (t.dateRaw || "-");
        var tdDesc = document.createElement("td"); tdDesc.textContent = t.description;
        var tdAmt = document.createElement("td"); tdAmt.className = "num";
        tdAmt.textContent = yen(t.amount);
        if (t.amountUnparsed) { var w = document.createElement("span"); w.className = "warn-icon"; w.title = "金額を読み取れませんでした: " + t.amountRaw; w.textContent = "⚠"; tdAmt.appendChild(w); }
        if (t.isOcr) { var ob = document.createElement("span"); ob.className = "badge badge-ocr"; ob.style.marginLeft = "6px"; ob.title = "画像認識(OCR)による自動読み取りです。誤読の可能性があるため、金額を元のPDFと見比べてください。"; ob.textContent = "OCR"; tdAmt.appendChild(ob); }
        var tdCat = document.createElement("td");
        var sel = buildCategorySelect(t);
        sel.addEventListener("change", function () {
          var parts = sel.value.split("::");
          t.category = parts[0]; t.subcategory = parts[1]; t.manual = true;
          renderAll(true);
        });
        tdCat.appendChild(sel);
        if (t.manual) { var m = document.createElement("span"); m.className = "hint"; m.style.marginLeft = "6px"; m.textContent = "(手動)"; tdCat.appendChild(m); }
        var tdAction = document.createElement("td");
        var addBtn = document.createElement("button");
        addBtn.className = "btn btn-ghost btn-sm";
        addBtn.type = "button";
        addBtn.textContent = "ルール追加";
        addBtn.addEventListener("click", function () { toggleInlineRule(tr, t); });
        tdAction.appendChild(addBtn);
        tr.appendChild(tdDate); tr.appendChild(tdDesc); tr.appendChild(tdAmt); tr.appendChild(tdCat); tr.appendChild(tdAction);
        tbody.appendChild(tr);

        var panelRow = document.createElement("tr");
        panelRow.style.display = "none";
        panelRow.dataset.panelFor = t.id;
        var panelCell = document.createElement("td");
        panelCell.colSpan = 5;
        var panel = document.createElement("div");
        panel.className = "inline-rule-panel";
        var kwInput = document.createElement("input"); kwInput.type = "text"; kwInput.value = t.description;
        var catSel = document.createElement("select");
        CAT_ORDER.forEach(function (key) { var o = document.createElement("option"); o.value = key; o.textContent = CATS[key].label; catSel.appendChild(o); });
        var subSel = document.createElement("select");
        function fillSub() {
          subSel.innerHTML = "";
          CATS[catSel.value].subs.forEach(function (s) { var o = document.createElement("option"); o.value = s; o.textContent = s; subSel.appendChild(o); });
        }
        catSel.addEventListener("change", fillSub); fillSub();
        var saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-primary btn-sm"; saveBtn.type = "button"; saveBtn.textContent = "ルールを保存";
        saveBtn.addEventListener("click", function () {
          var kw = kwInput.value.trim();
          if (!kw) return;
          rules.push(withId({ keyword: kw, category: catSel.value, subcategory: subSel.value }));
          saveRules();
          reclassifyAll();
          renderAll();
        });
        [kwInput, catSel, subSel, saveBtn].forEach(function (el) { panel.appendChild(el); });
        panelCell.appendChild(panel);
        panelRow.appendChild(panelCell);
        tbody.appendChild(panelRow);
      });
  }

  function toggleInlineRule(tr, t) {
    var tbody = tr.parentElement;
    var panelRow = Array.prototype.find.call(tbody.children, function (r) { return r.dataset && r.dataset.panelFor === t.id; });
    if (!panelRow) return;
    var panel = panelRow.querySelector(".inline-rule-panel");
    var isOpen = panel.classList.contains("open");
    tbody.querySelectorAll(".inline-rule-panel.open").forEach(function (p) { p.classList.remove("open"); p.closest("tr").style.display = "none"; });
    if (!isOpen) { panel.classList.add("open"); panelRow.style.display = ""; }
  }

  function renderRulesTable() {
    var tbody = document.querySelector("#rules-table tbody");
    tbody.innerHTML = "";
    rules.forEach(function (r) {
      var tr = document.createElement("tr");
      var tdKw = document.createElement("td"); tdKw.textContent = r.keyword;
      var tdCat = document.createElement("td"); tdCat.appendChild(categoryBadge(r.category));
      var tdSub = document.createElement("td"); tdSub.textContent = r.subcategory;
      var tdDel = document.createElement("td");
      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm btn-danger"; delBtn.type = "button"; delBtn.textContent = "削除";
      delBtn.addEventListener("click", function () {
        rules = rules.filter(function (x) { return x.id !== r.id; });
        saveRules(); reclassifyAll(); renderAll();
      });
      tdDel.appendChild(delBtn);
      tr.appendChild(tdKw); tr.appendChild(tdCat); tr.appendChild(tdSub); tr.appendChild(tdDel);
      tbody.appendChild(tr);
    });
  }

  function fillNewRuleSelects() {
    var catSel = document.getElementById("new-rule-category");
    catSel.innerHTML = "";
    CAT_ORDER.forEach(function (key) { var o = document.createElement("option"); o.value = key; o.textContent = CATS[key].label; catSel.appendChild(o); });
    function fillSub() {
      var subSel = document.getElementById("new-rule-subcategory");
      subSel.innerHTML = "";
      CATS[catSel.value].subs.forEach(function (s) { var o = document.createElement("option"); o.value = s; o.textContent = s; subSel.appendChild(o); });
    }
    catSel.addEventListener("change", fillSub);
    fillSub();
  }

  function renderAll(skipTxTable) {
    var hasData = transactions.length > 0;
    document.getElementById("empty-state").style.display = hasData ? "none" : "block";
    document.getElementById("results-section").style.display = hasData ? "block" : "none";
    renderRulesTable();
    if (!hasData) return;

    var agg = computeTotals();
    var total = agg.totals.fixed + agg.totals.fun + agg.totals.unknown;
    document.getElementById("period-label").textContent = (agg.minDate && agg.maxDate) ? ("対象期間: " + agg.minDate + " 〜 " + agg.maxDate + "（" + transactions.length + "件）") : ("（" + transactions.length + "件）");

    renderStatTiles(agg.totals, total);
    renderComposition(agg.totals, total);
    renderSubcatChart(agg.sub, total);
    renderMonthly(agg.monthly, agg.minDate, agg.maxDate);
    renderBreakdownTable(agg.sub, agg.totals, total);
    if (!skipTxTable) renderTransactionsTable(); else renderTransactionsTablePreserving();
  }

  function renderTransactionsTablePreserving() { renderTransactionsTable(); }

  // ---------- export ----------
  function downloadBlob(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // Neutralize spreadsheet formula injection: a description crafted like
  // "=HYPERLINK(...)" would execute when the exported CSV is opened in Excel.
  function csvSafe(v) {
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    s = s.replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? '"' + s + '"' : s;
  }
  function exportCSV() {
    var lines = ["日付,内容,金額,カテゴリ,サブカテゴリ,判定方法"];
    transactions.forEach(function (t) {
      var dateStr = t.date ? (t.date.year + "/" + t.date.month) : t.dateRaw;
      var row = [dateStr, t.description, t.amount, CATS[t.category].label, t.subcategory, t.manual ? "手動" : "自動"]
        .map(csvSafe);
      lines.push(row.join(","));
    });
    downloadBlob(lines.join("\n"), "支出分析_分類済み.csv", "text/csv;charset=utf-8");
  }
  function exportRules() {
    downloadBlob(JSON.stringify(rules.map(function (r) { return { keyword: r.keyword, category: r.category, subcategory: r.subcategory }; }), null, 2), "分類ルール.json", "application/json");
  }
  function importRulesFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed)) throw new Error("invalid");
        var valid = parsed.filter(function (r) { return r && r.keyword && CATS[r.category]; });
        var merge = confirm(valid.length + "件のルールを読み込みました。「OK」で既存ルールに追加、「キャンセル」で置き換えます。");
        if (merge) {
          rules = rules.concat(valid.map(withId));
        } else {
          rules = valid.map(withId);
        }
        saveRules(); reclassifyAll(); renderAll();
      } catch (err) {
        alert("ルールファイルを読み込めませんでした。");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  // ---------- wire up ----------
  document.getElementById("load-sample").addEventListener("click", function () {
    lastInputWasOcr = false;
    document.getElementById("ocr-offer").style.display = "none";
    document.getElementById("paste-area").value = SAMPLE_CSV;
    document.getElementById("file-input").value = "";
    analyzeInput();
  });
  document.getElementById("paste-area").addEventListener("change", function () {
    lastInputWasOcr = false;
    analyzeInput();
  });
  document.getElementById("file-input").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (file && /\.pdf$/i.test(file.name)) {
      handlePdfFile(file);
    } else {
      lastInputWasOcr = false;
      analyzeInput();
    }
  });
  document.getElementById("encoding-select").addEventListener("change", analyzeInput);
  document.getElementById("has-header").addEventListener("change", analyzeInput);
  document.getElementById("classify-btn").addEventListener("click", runClassification);
  document.getElementById("tx-search").addEventListener("input", function () { renderTransactionsTable(); });
  document.getElementById("export-csv").addEventListener("click", exportCSV);
  document.getElementById("export-rules").addEventListener("click", exportRules);
  document.getElementById("import-rules-btn").addEventListener("click", function () { document.getElementById("import-rules-file").click(); });
  document.getElementById("import-rules-file").addEventListener("change", function (e) {
    if (e.target.files[0]) importRulesFile(e.target.files[0]);
    e.target.value = "";
  });
  var clearBtn = document.getElementById("clear-all");
  if (clearBtn) clearBtn.addEventListener("click", function () {
    if (!confirm("この端末のブラウザに保存された分類ルールとテーマ設定を消去します。よろしいですか？")) return;
    try { localStorage.removeItem(LS_RULES); localStorage.removeItem(LS_THEME); } catch (e) {}
    rules = DEFAULT_RULES.map(withId);
    transactions = [];
    applyTheme(null);
    renderAll();
  });
  document.getElementById("reset-rules").addEventListener("click", function () {
    if (!confirm("分類ルールを初期状態に戻します。よろしいですか？")) return;
    rules = DEFAULT_RULES.map(withId);
    saveRules(); reclassifyAll(); renderAll();
  });
  document.getElementById("add-rule-btn").addEventListener("click", function () {
    var kw = document.getElementById("new-rule-keyword").value.trim();
    if (!kw) return;
    var cat = document.getElementById("new-rule-category").value;
    var sub = document.getElementById("new-rule-subcategory").value;
    rules.push(withId({ keyword: kw, category: cat, subcategory: sub }));
    saveRules();
    document.getElementById("new-rule-keyword").value = "";
    reclassifyAll(); renderAll();
  });

  setTimeout(function () {
    if (!window.pdfjsLib) {
      var hint = document.getElementById("pdf-hint");
      hint.style.color = "var(--danger)";
      hint.textContent = "⚠ PDF読み込みライブラリを読み込めませんでした。pdf.min.js / pdf.worker.min.js がこのHTMLと同じフォルダに置かれているかご確認ください（CSVの貼り付け/アップロードは問題なく使えます）。";
    }
  }, 2500);

  fillNewRuleSelects();
  renderRulesTable();
})();
