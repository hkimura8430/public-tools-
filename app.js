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
      stats.push({ c: c, dateHits: dateHits, amountHits: amountHits, avgLen: n ? lenSum / n : 0, n: n });
    }
    // Require a real majority of a column's (non-empty) values to look like
    // dates before trusting it -- a single stray date-shaped substring inside
    // an unrelated free-text column (e.g. OCR noise mentioning "2026年02月")
    // must not be enough to hijack the date-column pick, especially when the
    // true date column is mostly/entirely empty (common for OCR rows where
    // the date couldn't be read) and so never gets a chance to outscore it.
    var dateCol = null, best = 0;
    stats.forEach(function (s) {
      if (s.n < 2 || s.dateHits < 2) return;
      var ratio = s.dateHits / s.n;
      if (ratio >= 0.5 && s.dateHits > best) { best = s.dateHits; dateCol = s.c; }
    });
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
  var NON_TX_RE = /(合計|小計|残高|残額|ご利用可能|可能枠|変更可能|繰越|お支払[いｉ]?金額|締切|支払日|支払コース|手数料率|実質年率|融資利率|ポイント|獲得|ページ目|明細作成日|登録番号|口座番号|口座名義|金融機関|支店名|財務局|ご利用分|標準コース|分割払い|万円|請求明細書|請求確定日|ご請求金額|請求年月|翌月以降)/;
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
    // OCR sometimes inserts a stray space inside a keyword (e.g. "残 額"),
    // which would dodge a literal-substring match. Test a whitespace-free
    // copy too so keyword detection survives that kind of noise.
    if (NON_TX_RE.test(line) || NON_TX_RE.test(line.replace(/\s+/g, ""))) return true;
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
    // The duplicate column doesn't always carry the same comma formatting
    // (e.g. final amount "1,222" vs a duplicate column OCR'd as plain "1222"),
    // so try both forms.
    var variants = amountClean.indexOf(",") !== -1 ? [amountClean, amountClean.replace(/,/g, "")] : [amountClean];
    for (var v = 0; v < variants.length; v++) {
      var needle = variants[v];
      var idx = text.indexOf(needle);
      if (idx === -1) continue;
      var before = idx === 0 ? " " : text.charAt(idx - 1);
      var afterIdx = idx + needle.length;
      if (text.charAt(afterIdx) === "円") afterIdx += 1;
      var after = afterIdx >= text.length ? " " : text.charAt(afterIdx);
      if (/\s/.test(before) && /\s/.test(after)) {
        return text.slice(0, idx) + " " + text.slice(afterIdx);
      }
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
    var s = t.replace(/^[\d\s!！?？iIlｌ\[\]（）().,\-一ー]{2,20}/, "").trim();
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

  // ---------- gridline-based table extraction (preferred when available) ----------
  // Whole-line OCR + regex splitting (above) has a structural weakness: when a
  // row's cells sit close together, Tesseract's own word/line segmentation
  // merges neighboring cells into one blob (e.g. a date column glued onto the
  // start of the next store name), and multi-character store names can get
  // fragmented. A bordered statement table's column dividers are real black
  // vertical lines, so instead of reading them as text we scan for them as
  // pixels: a column boundary is an x position that stays dark for almost the
  // full height of several stacked row-bands. That is a much more reliable
  // signal than OCR text ever is, and it lets us crop out one column at a
  // time and OCR each in isolation -- so a row's date, store name, and amount
  // are never seen by the OCR engine in the same pass and can't bleed into
  // each other. Non-table pages (a points summary, a payment-plan table with
  // no real grid) naturally fail the "same lines repeat across several
  // stacked bands" check below and fall back to the existing whole-line path.
  var GRIDLINE_BAND_HEIGHT = 300;
  var GRIDLINE_MIN_COVERAGE = 0.85;
  var GRIDLINE_MIN_GAP = 30; // px; rejects dense noise (character strokes) misread as a grid
  var GRIDLINE_MATCH_TOLERANCE = 6; // px
  var GRIDLINE_MIN_RUN_BANDS = 2; // require the same grid to repeat across >=2 bands before trusting it

  function findGridlinesInBand(ctx, w, yTop, yBottom, minCoverage) {
    var bandH = yBottom - yTop;
    var imgData = ctx.getImageData(0, yTop, w, bandH);
    var d = imgData.data;
    var counts = new Array(w).fill(0);
    for (var y = 0; y < bandH; y++) {
      var rowOffset = y * w * 4;
      for (var x = 0; x < w; x++) {
        if (d[rowOffset + x * 4] < 128) counts[x]++;
      }
    }
    var threshold = bandH * minCoverage;
    var lines = [];
    var runStart = null;
    for (var xi = 0; xi < w; xi++) {
      if (counts[xi] >= threshold) {
        if (runStart === null) runStart = xi;
      } else if (runStart !== null) {
        lines.push({ start: runStart, end: xi - 1, mid: Math.round((runStart + xi - 1) / 2) });
        runStart = null;
      }
    }
    if (runStart !== null) lines.push({ start: runStart, end: w - 1, mid: Math.round((runStart + w - 1) / 2) });
    return lines;
  }

  function gridlinesMatch(a, b, tolerance) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (Math.abs(a[i].mid - b[i].mid) > tolerance) return false;
    }
    return true;
  }

  // Scans the whole page in horizontal bands and returns the tallest region
  // where the same set of vertical gridlines repeats across consecutive
  // bands -- i.e. a real, consistently-bordered table -- or null if nothing
  // qualifies (the page has no such table, or it's too short to trust).
  function detectTableRegion(ctx, w, h) {
    var bands = [];
    for (var y = 0; y < h; y += GRIDLINE_BAND_HEIGHT) {
      var yEnd = Math.min(y + GRIDLINE_BAND_HEIGHT, h);
      if (yEnd - y < GRIDLINE_BAND_HEIGHT * 0.5) break;
      var raw = findGridlinesInBand(ctx, w, y, yEnd, GRIDLINE_MIN_COVERAGE);
      var ok = raw.length >= 4;
      if (ok) {
        for (var i = 1; i < raw.length; i++) {
          if (raw[i].mid - raw[i - 1].mid < GRIDLINE_MIN_GAP) { ok = false; break; }
        }
      }
      bands.push({ yTop: y, yBottom: yEnd, lines: ok ? raw : null });
    }
    var best = null;
    var bi = 0;
    while (bi < bands.length) {
      if (!bands[bi].lines) { bi++; continue; }
      var bj = bi + 1;
      while (bj < bands.length && bands[bj].lines && gridlinesMatch(bands[bi].lines, bands[bj].lines, GRIDLINE_MATCH_TOLERANCE)) bj++;
      var runBands = bj - bi;
      var height = bands[bj - 1].yBottom - bands[bi].yTop;
      if (runBands >= GRIDLINE_MIN_RUN_BANDS && (!best || height > best.height)) {
        best = { yTop: bands[bi].yTop, yBottom: bands[bj - 1].yBottom, lines: bands[bi].lines, height: height };
      }
      bi = bj;
    }
    if (best) best = refineRegionBoundaries(ctx, w, h, best);
    return best;
  }

  // The coarse band scan above only tests fixed 300px-aligned slices, so a
  // table whose real top/bottom border doesn't happen to land on one of
  // those boundaries gets clipped -- losing a few real rows right at the
  // edge (seen in testing: the first 2-3 transaction rows silently dropped
  // because the table actually started partway through the first band that
  // failed the check). This extends yTop/yBottom outward one row at a time,
  // checking only the already-known gridline x positions (cheap -- no need
  // to rescan the full row width), stopping as soon as a row isn't dark at
  // most of them, i.e. the real border. Capped so it can't run away into
  // unrelated content above/below that coincidentally has dark pixels at a
  // few of the same x positions.
  var GRIDLINE_REFINE_MAX_EXTEND = 500;
  function isRowDarkAtX(ctx, w, y, xs, minFrac) {
    var imgData = ctx.getImageData(0, y, w, 1);
    var d = imgData.data;
    var dark = 0;
    for (var i = 0; i < xs.length; i++) if (d[xs[i] * 4] < 128) dark++;
    return dark / xs.length >= minFrac;
  }
  function refineRegionBoundaries(ctx, w, h, region) {
    var xs = region.lines.map(function (l) { return l.mid; });
    var yTop = region.yTop;
    var extended = 0;
    while (yTop > 0 && extended < GRIDLINE_REFINE_MAX_EXTEND && isRowDarkAtX(ctx, w, yTop - 1, xs, 0.8)) { yTop--; extended++; }
    var yBottom = region.yBottom;
    extended = 0;
    while (yBottom < h && extended < GRIDLINE_REFINE_MAX_EXTEND && isRowDarkAtX(ctx, w, yBottom, xs, 0.8)) { yBottom++; extended++; }
    yTop = skipHeaderRow(ctx, w, yTop, yBottom, region.lines);
    return { yTop: yTop, yBottom: yBottom, lines: region.lines, height: yBottom - yTop };
  }

  // Some statement layouts put the column header ("利用日" / "利用店名・商品名"
  // / ...) inside the same bordered grid as the data rows, with its own
  // horizontal divider line underneath it -- so it gets swept into the
  // region above as if it were just another data row (its header text wraps
  // across several short OCR lines in a narrow column, inflating that
  // column's row count and throwing off the date-column-based row counting
  // used everywhere else here). Detect that divider -- a horizontal run that
  // is dark across nearly the full column span, sitting a little below the
  // table's own top border -- and move yTop past it. Capped to a plausible
  // single-row height so it can't mistake an early DATA row's own divider
  // for a header divider and skip real transactions.
  var HEADER_ROW_MAX_HEIGHT = 160;
  function isRowDarkAcrossSpan(ctx, w, y, xFrom, xTo, minFrac) {
    var span = xTo - xFrom;
    if (span <= 0) return false;
    var imgData = ctx.getImageData(xFrom, y, span, 1);
    var d = imgData.data;
    var dark = 0;
    for (var x = 0; x < span; x++) if (d[x * 4] < 128) dark++;
    return dark / span >= minFrac;
  }
  function skipHeaderRow(ctx, w, yTop, yBottom, lines) {
    var xFrom = lines[0].mid, xTo = lines[lines.length - 1].mid;
    var limit = Math.min(yTop + HEADER_ROW_MAX_HEIGHT, yBottom - 1);
    // y=yTop itself is the table's own top border; start looking just below it.
    for (var y = yTop + 2; y < limit; y++) {
      if (isRowDarkAcrossSpan(ctx, w, y, xFrom, xTo, 0.9)) return y + 1;
    }
    return yTop;
  }

  function cropCanvasRegion(srcCanvas, x0, y0, x1, y1) {
    var w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var cctx = c.getContext("2d");
    cctx.fillStyle = "#ffffff";
    cctx.fillRect(0, 0, w, h);
    cctx.drawImage(srcCanvas, x0, y0, w, h, 0, 0, w, h);
    return c;
  }

  async function ocrColumnLines(worker, srcCanvas, x0, y0, x1, y1) {
    var strip = cropCanvasRegion(srcCanvas, x0, y0, x1, y1);
    var result = await worker.recognize(strip);
    return (result.data.lines || [])
      .map(function (l) { return normalizeText(l.text || "").replace(/[|｜]/g, " ").replace(/\s+/g, " ").trim(); })
      .filter(Boolean);
  }

  // Parses a date-column OCR line once the column itself is known to contain
  // nothing but a date (no store name mixed in, since it was cropped out
  // separately) -- so unlike findDateInLine() this can be much more
  // permissive about separators. The statement's real format is always
  // "YY <sep> MM <sep> DD" with zero-padded month/day, and a misread
  // separator always shows up as exactly one stray digit glued onto the
  // group next to it (e.g. "26 02 26" -> "26102126") -- never scattered
  // arbitrarily. So after stripping everything but digits and taking the
  // first two as the year, only a handful of "junk?MMjunk?DD"-shaped splits
  // of the remainder are actually possible; trying those specific splits
  // (rather than every possible way to drop 2 of the remaining digits) means
  // a split that merely happens to be numerically valid, like misreading
  // "0226" out of "102126" as "10/21", never gets picked ahead of the real
  // "02/26" split that the expected shape points at first.
  function parseIsolatedDateColumnLine(raw) {
    var normalized = normalizeText(String(raw || ""));
    // Some layouts (e.g. a web-rendered statement printed to PDF, as opposed
    // to a dense bordered table) have enough room that OCR reads the date
    // cleanly with its real separators and a full 4-digit year, e.g.
    // "2026/7/31" -- try that directly first since it needs no guessing at
    // all, before falling back to the 2-digit-year/misread-separator logic
    // below (written for cramped tables where it doesn't come out this
    // clean).
    var clean = normalized.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})日?/);
    if (clean) {
      var cy = +clean[1], cm = +clean[2], cd = +clean[3];
      if (cm >= 1 && cm <= 12 && cd >= 1 && cd <= 31) return { year: cy, month: cm, day: cd };
    }
    var digits = normalized.replace(/\D/g, "");
    if (digits.length < 6) return null;
    var year = digits.slice(0, 2);
    var tail = digits.slice(2);
    var candidates = [];
    if (tail.length === 4) {
      candidates.push([tail.slice(0, 2), tail.slice(2, 4)]); // MMDD, no misread separators
    } else if (tail.length === 5) {
      candidates.push([tail.slice(1, 3), tail.slice(3, 5)]); // j MM DD
      candidates.push([tail.slice(0, 2), tail.slice(3, 5)]); // MM j DD
    } else if (tail.length === 6) {
      candidates.push([tail.slice(1, 3), tail.slice(4, 6)]); // j MM j DD -- the expected/most common case
      candidates.push([tail.slice(0, 2), tail.slice(3, 5)]); // MM j DD j
      candidates.push([tail.slice(2, 4), tail.slice(4, 6)]); // j j MM DD
    }
    for (var i = 0; i < candidates.length; i++) {
      var mo = +candidates[i][0], da = +candidates[i][1];
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) return { year: 2000 + +year, month: mo, day: da };
    }
    return null;
  }

  // A single misread digit can still assemble into a numerically-valid but
  // wrong date even with the targeted pattern-matching above (e.g. OCR
  // noise in an otherwise-fine row happens to shift a "02" into something
  // parseIsolatedDateColumnLine reads as "10"). A single statement's
  // transactions are always tightly clustered in time (usually a ~1 month
  // billing period, occasionally spilling a few days into the adjacent
  // month), so a date sitting months away from where every other date in
  // the same column landed is far more likely an isolated misread than a
  // genuine outlier transaction -- blank it out rather than risk shipping
  // a confidently-wrong month into the monthly chart.
  var DATE_OUTLIER_MAX_MONTH_GAP = 1;
  function rejectOutlierDates(parsedDates) {
    var monthCounts = {};
    parsedDates.forEach(function (dp) {
      if (!dp) return;
      var key = dp.year * 12 + (dp.month - 1); // absolute month index, so gaps compare correctly across a year boundary
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    });
    var keys = Object.keys(monthCounts);
    if (keys.length < 2) return parsedDates; // nothing to compare against
    var modeKey = null, modeCount = 0;
    keys.forEach(function (k) { if (monthCounts[k] > modeCount) { modeCount = monthCounts[k]; modeKey = +k; } });
    return parsedDates.map(function (dp) {
      if (!dp) return dp;
      var key = dp.year * 12 + (dp.month - 1);
      return Math.abs(key - modeKey) <= DATE_OUTLIER_MAX_MONTH_GAP ? dp : null;
    });
  }

  function cleanAmountColumnLine(raw) {
    var s = fixOcrThousands(normalizeText(String(raw || "")).trim());
    var m = s.match(AMOUNT_TOKEN_RE);
    if (!m || !m.length) return null;
    var clean = m[m.length - 1].replace(/[¥￥円\s]/g, "");
    var num = parseFloat(clean.replace(/,/g, ""));
    if (!num || num < 1) return null;
    return clean;
  }

  // Crops out EVERY column of a detected table region and OCRs each one in
  // isolation (so cells never bleed into each other the way a whole-line OCR
  // pass can), then hands back the raw per-column text for every row --
  // deliberately NOT guessing which column is the date/description/amount.
  // An earlier version of this function tried to guess those roles
  // geometrically (leftmost = date, widest = description, etc.), which
  // worked well on the statement layouts it was tuned against but silently
  // misfired on others: a free-text remarks column, a summary line that
  // happened to sit inside the same bordered region, or a format this app
  // has simply never seen before could all get mis-slotted into "amount" or
  // "description" with no way for the user to notice or correct it. Handing
  // back every column instead lets the existing date/content/amount column
  // pickers in section ① do that job -- the same pickers already used for a
  // manually pasted CSV -- so the user can see and fix a wrong guess instead
  // of trusting one silently, and a statement layout this function has never
  // encountered still works as long as its table has real border lines.
  async function extractTableRawColumns(worker, canvas, region) {
    var lines = region.lines;
    if (lines.length < 3) return null; // need at least 2 real columns
    var cols = [];
    for (var i = 0; i < lines.length - 1; i++) {
      var x0 = lines[i].end + 2;
      var x1 = lines[i + 1].start - 2;
      cols.push(x1 - x0 >= 10 ? { x0: x0, x1: x1, width: x1 - x0 } : null);
    }
    var validIdx = [];
    for (var ci = 0; ci < cols.length; ci++) if (cols[ci]) validIdx.push(ci);
    if (validIdx.length < 2) return null;

    var colLines = {};
    for (var vi = 0; vi < validIdx.length; vi++) {
      var idx = validIdx[vi];
      colLines[idx] = await ocrColumnLines(worker, canvas, cols[idx].x0, region.yTop, cols[idx].x1, region.yBottom);
    }

    // The leftmost column is the date column in every layout seen so far.
    // Some layouts put the column header ("利用日" etc.) inside the same
    // bordered grid with no divider line to key off of, so it ends up as
    // extra leading lines here -- drop any that don't parse as a date,
    // capped to a handful (a real header is always short; past that, the
    // column probably just OCR'd badly throughout rather than having a
    // long header, so leave the rest alone instead of over-trimming).
    var leftIdx = validIdx[0];
    var leftLines = colLines[leftIdx].slice();
    var trimmed = 0;
    while (leftLines.length && trimmed < 6 && !parseIsolatedDateColumnLine(leftLines[0])) { leftLines.shift(); trimmed++; }
    colLines[leftIdx] = leftLines;
    var leftParsed = leftLines.map(parseIsolatedDateColumnLine);
    var leftHits = leftParsed.filter(Boolean).length;

    // The row count needs to be determined reliably. Prefer the date
    // column's own (now header-trimmed) count when most of its lines
    // actually parsed as dates -- it's the most direct signal once cleaned
    // of header noise, and unlike a description column it never wraps
    // across multiple OCR lines regardless of column width. Only fall back
    // to cross-column agreement (numeric-looking columns that hold one
    // value per transaction, typically an amount repeated under two
    // different headings on a real statement, tend to agree with each
    // other on the row count) when the date column itself came out too
    // noisy to trust -- this was seen on a real statement page dense
    // enough that even column-isolated OCR couldn't read the dates cleanly
    // while the amount columns right next to them still read fine.
    var n = null;
    if (leftLines.length >= 2 && leftHits / leftLines.length >= 0.7) {
      n = leftLines.length;
    } else {
      var numericResults = validIdx.map(function (idx) {
        var ls = colLines[idx];
        var parsed = ls.map(cleanAmountColumnLine);
        var hits = parsed.filter(Boolean).length;
        return { idx: idx, count: ls.length, rate: ls.length ? hits / ls.length : 0 };
      });
      var qualifying = numericResults.filter(function (r) { return r.count >= 2 && r.rate >= 0.7; });
      n = pickConsensusCount(qualifying);
      if (!n) {
        // No numeric column at all (an all-text table) -- fall back to
        // whichever non-trivial line count the most columns share.
        n = pickConsensusCount(validIdx.map(function (idx) { return { count: colLines[idx].length }; }).filter(function (r) { return r.count >= 2; }));
      }
    }
    if (!n || n < 2) return null;

    // Build the final per-column values: the date column gets normalized
    // ("2026/2/26" instead of raw OCR text like "26102126") so it's
    // actually usable by the existing date parser once the user picks it
    // as the date column downstream -- the raw digit string doesn't match
    // any format that parser recognizes. Every other column keeps its raw
    // OCR text (so the user can see and judge it), but still gets the same
    // comma/period misread fix ("21.800" -> "21,800") already applied
    // elsewhere to OCR'd amounts, since the user may pick any of them as
    // the amount column and an unfixed value would silently parse wrong
    // (e.g. "21.800" read as a 21.8 decimal instead of 21,800 yen).
    var dateAligned = leftLines.slice(Math.max(0, leftLines.length - n)).map(parseIsolatedDateColumnLine);
    dateAligned = rejectOutlierDates(dateAligned);
    colLines[leftIdx] = dateAligned.map(function (dp) { return dp ? (dp.year + "/" + dp.month + "/" + dp.day) : ""; });
    validIdx.forEach(function (idx) {
      if (idx === leftIdx) return;
      var ls = colLines[idx].slice(Math.max(0, colLines[idx].length - n));
      colLines[idx] = ls.map(function (v) { return fixOcrThousands(v); });
    });

    var rows = [];
    var filledCells = 0;
    for (var r = 0; r < n; r++) {
      var rowVals = validIdx.map(function (idx) { return colLines[idx][r] || ""; });
      if (rowVals.every(function (v) { return !v; })) continue; // fully blank row
      // Drop rows that are clearly a summary/disclaimer line rather than a
      // transaction (e.g. "ご請求金額", "お支払い口座") that happened to sit
      // inside the same bordered region as the real table -- the same
      // keyword check already used for the whole-line OCR fallback, applied
      // across this row's columns together instead of one OCR'd line.
      var joined = rowVals.join(" ");
      if (NON_TX_RE.test(joined) || NON_TX_RE.test(joined.replace(/\s+/g, ""))) continue;
      filledCells += rowVals.filter(Boolean).length;
      rows.push(rowVals);
    }
    if (rows.length < 2) return null;
    // A mostly-blank result (seen in testing on a payment-plan summary
    // table with lots of unused cells, e.g. no revolving balance to show)
    // means the row count the logic above landed on doesn't actually
    // correspond to real transaction rows -- a couple of near-empty rows
    // slipping past the NON_TX_RE check isn't worth keeping over conceding
    // this page to the whole-line fallback.
    var avgFilled = filledCells / (rows.length * validIdx.length);
    if (avgFilled < 0.3) return null;

    // Column header text (e.g. "ご利用日") isn't OCR'd for the output here.
    // It was tried: on a real statement its header row sits right next to
    // (sometimes touching) unrelated text above the data table -- a
    // disclaimer sentence, a section title -- with no divider line this
    // code can key off of to crop just the header cleanly. In testing,
    // even after filtering out the worst of it (long run-on-sentence
    // fragments), what was left still came out wrong often enough (e.g.
    // one real column's header OCR'd as an unrelated short phrase from a
    // nearby heading) to be a worse labeling source than the neutral "列N"
    // placeholder rawColumnsToCsvText() falls back to -- a specific-looking
    // but wrong label is more misleading than an honestly generic one.
    return { rows: rows, numCols: validIdx.length };
  }

  // Given candidates with a .count, returns the count value shared by the
  // most candidates (ties broken toward the larger count, since OCR more
  // often drops a line than invents one).
  function pickConsensusCount(candidates) {
    if (!candidates.length) return null;
    var groups = {};
    candidates.forEach(function (r) { (groups[r.count] = groups[r.count] || []).push(r); });
    var bestCount = null, bestSize = 0;
    Object.keys(groups).forEach(function (k) {
      var size = groups[k].length;
      if (size > bestSize || (size === bestSize && +k > bestCount)) { bestSize = size; bestCount = +k; }
    });
    return bestCount;
  }

  // Builds a plain CSV from raw per-column OCR rows, with a generic "列N"
  // header so the existing column pickers have something to show instead of
  // a bare index -- there's no way to know which column is semantically
  // which without the user's input, by design (see extractTableRawColumns).
  // (OCRing the real header text, e.g. "ご利用日", was tried and dropped --
  // see the comment at the end of extractTableRawColumns for why.)
  function rawColumnsToCsvText(rows, numCols) {
    var header = [];
    for (var c = 0; c < numCols; c++) header.push("列" + (c + 1));
    var out = [header.join(",")];
    rows.forEach(function (r) {
      var fields = [];
      for (var c = 0; c < numCols; c++) {
        var v = r[c] === undefined ? "" : String(r[c]);
        fields.push(/[,"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
      }
      out.push(fields.join(","));
    });
    return out.join("\n");
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
      var rawColumnRows = [];
      var rawNumCols = 0;
      var anyGridlineSuccess = false;
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

        // Prefer cropping out the table's own columns (via its border lines)
        // and OCRing each in isolation -- far more accurate than reading a
        // whole row as one string, since it can't merge neighboring cells
        // together. Which column is the date/content/amount is NOT guessed
        // here (see extractTableRawColumns for why) -- that's left to the
        // same column pickers used for a manually pasted CSV. If this page
        // has no reliably-bordered table (a summary page, or an
        // unrecognized layout), region/rawResult end up null and this page
        // falls back to the original whole-line approach unchanged below.
        var region = null;
        try { region = detectTableRegion(ctx, canvas.width, canvas.height); } catch (e) { region = null; }
        var rawResult = null;
        if (region) {
          progressEl.textContent = "ページ " + p + "/" + pdf.numPages + " の表の列を認識中...";
          try { rawResult = await extractTableRawColumns(worker, canvas, region); } catch (e) { rawResult = null; }
        }

        if (rawResult && rawResult.rows.length) {
          anyGridlineSuccess = true;
          rawColumnRows = rawColumnRows.concat(rawResult.rows);
          rawNumCols = Math.max(rawNumCols, rawResult.numCols);
        } else {
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
      }
      await worker.terminate();
      worker = null;
      progressEl.textContent = "";

      // If at least one page succeeded via the column-cropping path, use
      // its raw (unlabeled) columns for the WHOLE document -- including
      // folding in any other page's date/content/amount fallback rows as
      // plain 3-column rows -- so nothing from a mixed-quality document
      // gets silently dropped, and the user picks date/content/amount from
      // whichever real columns came out, instead of this code guessing.
      if (anyGridlineSuccess) {
        allRows.forEach(function (r) { rawColumnRows.push([r.date, r.desc, r.amount]); });
        rawNumCols = Math.max(rawNumCols, 3);
        if (!rawColumnRows.length) {
          status.textContent = "⚠ OCRでも取引らしき行を認識できませんでした。お手数ですがCSVでの入力をお試しください。";
          return;
        }
        lastInputWasOcr = true;
        document.getElementById("paste-area").value = rawColumnsToCsvText(rawColumnRows, rawNumCols);
        analyzeInput();
        status.textContent = "⚠ OCRで表の列を" + rawNumCols + "列、" + rawColumnRows.length + "行読み取りました。下の「日付の列」「内容の列」「金額の列」で、実際に日付・内容・金額に対応する列を確認・選択してから「分類する」を押してください（自動推定は参考程度です）。画像認識のため誤読の可能性があるので、内容を元のPDFと見比べてください。";
        document.getElementById("ocr-offer").style.display = "none";
        return;
      }

      // Note: a page fully handled by the gridline/column path never adds to
      // allLines (it never runs the whole-page OCR call at all), so allLines
      // being empty does NOT mean nothing was recognized -- only allRows
      // reflects the combined result of both paths.
      if (!allLines.length && !allRows.length) {
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

  // Renders the actually-parsed rows as a real table (header row + data
  // rows, one cell per column) instead of leaving the user to eyeball
  // commas in the raw pasted/OCR'd text to figure out which column is
  // which. Capped to a sample of rows -- this is for visually confirming
  // the column layout, not for browsing every row (section ⑦ already
  // covers that).
  var PREVIEW_MAX_ROWS = 30;
  function renderPreviewTable(headerRow, hasHeader, numCols) {
    var wrap = document.getElementById("preview-table-wrap");
    var table = document.getElementById("preview-table");
    var thead = table.querySelector("thead");
    var tbody = table.querySelector("tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";
    if (!lastRawRows.length || !numCols) { wrap.style.display = "none"; return; }
    wrap.style.display = "block";

    var headTr = document.createElement("tr");
    for (var c = 0; c < numCols; c++) {
      var th = document.createElement("th");
      th.textContent = (hasHeader && headerRow[c]) ? headerRow[c] : ("列" + (c + 1));
      th.dataset.col = c;
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);

    var dataRows = hasHeader ? lastRawRows.slice(1) : lastRawRows;
    dataRows.slice(0, PREVIEW_MAX_ROWS).forEach(function (r) {
      var tr = document.createElement("tr");
      for (var c = 0; c < numCols; c++) {
        var td = document.createElement("td");
        td.textContent = r[c] || "";
        td.title = r[c] || "";
        td.dataset.col = c;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    if (dataRows.length > PREVIEW_MAX_ROWS) {
      var moreTr = document.createElement("tr");
      var moreTd = document.createElement("td");
      moreTd.colSpan = numCols;
      moreTd.className = "hint";
      moreTd.style.whiteSpace = "normal";
      moreTd.textContent = "...ほか " + (dataRows.length - PREVIEW_MAX_ROWS) + " 行（分類には全行が使われます）";
      moreTr.appendChild(moreTd);
      tbody.appendChild(moreTr);
    }
    updatePreviewHighlight();
  }

  // Tints the whole column currently selected in the 日付/内容/金額 pickers
  // so picking a column and seeing it highlighted in the preview table is
  // one glance, not a separate lookup. Re-run on every picker change --
  // cheap (just toggling classes on already-built cells), no re-parse.
  function updatePreviewHighlight() {
    var table = document.getElementById("preview-table");
    if (!table) return;
    var dateCol = document.getElementById("col-date").value;
    var descCol = document.getElementById("col-desc").value;
    var amountCol = document.getElementById("col-amount").value;
    Array.prototype.forEach.call(table.querySelectorAll("th, td"), function (cell) {
      cell.classList.remove("col-highlight-date", "col-highlight-desc", "col-highlight-amount");
      var c = cell.dataset.col;
      if (c === undefined) return; // the "...ほかN行" row's colspan cell has no column
      if (c === dateCol) cell.classList.add("col-highlight-date");
      else if (c === descCol) cell.classList.add("col-highlight-desc");
      else if (c === amountCol) cell.classList.add("col-highlight-amount");
    });
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
      renderPreviewTable(rowsAll[0], hasHeader, guess.numCols);
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
    var minDate = null, maxDate = null;
    transactions.forEach(function (t) {
      totals[t.category] += t.amount;
      sub[t.category][t.subcategory] = (sub[t.category][t.subcategory] || 0) + t.amount;
      if (t.date) {
        if (minDate === null || t.date.key < minDate) minDate = t.date.key;
        if (maxDate === null || t.date.key > maxDate) maxDate = t.date.key;
      }
    });
    return { totals: totals, sub: sub, minDate: minDate, maxDate: maxDate };
  }

  // Vertical list to the right of the ② pie chart: total first, then one
  // line per category with its amount and share.
  function renderStatTiles(totals, total) {
    var wrap = document.getElementById("stat-tiles");
    wrap.innerHTML = "";
    var hero = document.createElement("div");
    hero.className = "stat-line hero";
    hero.innerHTML = '<div class="label">総支出</div><div class="value">' + yen(total) + "</div>";
    wrap.appendChild(hero);
    CAT_ORDER.forEach(function (key) {
      var c = CATS[key];
      var v = totals[key];
      var line = document.createElement("div");
      line.className = "stat-line";
      var share = total ? v / total : 0;
      line.innerHTML =
        '<div class="label"><span class="swatch" style="background:' + c.color + '"></span>' + c.label + "</div>" +
        '<div class="value">' + yen(v) + '<span class="share">' + pct(share) + "</span></div>";
      wrap.appendChild(line);
    });
  }

  // ② pie chart: one SVG <path> wedge per non-zero category (a plain
  // <circle> for the degenerate "100% one category" case, since an arc
  // path can't represent a full circle). Built as separate elements rather
  // than a single CSS conic-gradient so each wedge can still carry its own
  // hover/focus tooltip, the same interaction every other chart in this
  // tool already uses.
  function renderComposition(totals, total) {
    var wrap = document.getElementById("pie-chart");
    wrap.innerHTML = "";
    var nonZero = CAT_ORDER.filter(function (key) { return totals[key] > 0; });
    if (!nonZero.length || !total) return;

    var svgNS = "http://www.w3.org/2000/svg";
    var size = 180, cx = size / 2, cy = size / 2, r = size / 2 - 4;
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "カテゴリ別支出の割合");

    if (nonZero.length === 1) {
      var onlyKey = nonZero[0];
      var circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", cx); circle.setAttribute("cy", cy); circle.setAttribute("r", r);
      circle.setAttribute("fill", CATS[onlyKey].color);
      circle.tabIndex = 0;
      wireTooltip(circle, function () { return [{ color: CATS[onlyKey].color, value: yen(totals[onlyKey]), label: CATS[onlyKey].label + "（100.0%）" }]; });
      svg.appendChild(circle);
    } else {
      var angle = -Math.PI / 2; // start at 12 o'clock, sweep clockwise
      nonZero.forEach(function (key) {
        var v = totals[key];
        var share = v / total;
        var sweep = share * 2 * Math.PI;
        var endAngle = angle + sweep;
        var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        var x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
        var largeArc = sweep > Math.PI ? 1 : 0;
        var d = "M" + cx + "," + cy + " L" + x1 + "," + y1 + " A" + r + "," + r + " 0 " + largeArc + " 1 " + x2 + "," + y2 + " Z";
        var path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", CATS[key].color);
        path.tabIndex = 0;
        wireTooltip(path, function () { return [{ color: CATS[key].color, value: yen(v), label: CATS[key].label + "（" + pct(share) + "）" }]; });
        svg.appendChild(path);
        angle = endAngle;
      });
    }
    wrap.appendChild(svg);
  }

  // Every subcategory under the same parent category shares that parent's
  // base color (used for ② and for this chart's own legend swatches), so a
  // pie of subcategories can't just reuse CATS[key].color directly --
  // adjacent same-colored wedges would be indistinguishable without a
  // label squeezed onto every slice. These are shades of each parent's
  // hue instead: still visually grouped as "part of 固定生活費" at a
  // glance, but distinguishable from each other. Cycles if a custom rule
  // ever produces more subcategories than a palette has shades for.
  var SUBCAT_SHADE_PALETTE = {
    fixed: ["#2a78d6", "#1a4f8f", "#4a93e8", "#7fb6f0", "#123a6b", "#a8d0f7"],
    fun: ["#eb6834", "#b84a1a", "#f2894f", "#ffb183"],
    unknown: ["#9c9b95", "#6f6e68", "#c2c1ba"]
  };
  function subcatColor(catKey, indexWithinCat) {
    var palette = SUBCAT_SHADE_PALETTE[catKey] || [CATS[catKey] ? CATS[catKey].color : "#999"];
    return palette[indexWithinCat % palette.length];
  }

  // ③ pie chart of subcategories (食費・通信・...): a sorted bar list makes
  // it easy to compare any two specific rows, but hard to judge "how big a
  // slice of the WHOLE is this" at a glance -- the thing a pie/donut shape
  // communicates directly through its angle. Grouped by parent category
  // first (CAT_ORDER), sorted by amount within each group, so same-hue
  // wedges land next to each other in the circle instead of being
  // scattered by a pure value sort.
  function renderSubcatChart(sub, total) {
    var pieWrap = document.getElementById("subcat-pie");
    var listWrap = document.getElementById("subcat-list");
    pieWrap.innerHTML = ""; listWrap.innerHTML = "";

    var entries = [];
    CAT_ORDER.forEach(function (key) {
      var names = Object.keys(sub[key]).filter(function (n) { return sub[key][n] > 0; });
      names.sort(function (a, b) { return sub[key][b] - sub[key][a]; });
      names.forEach(function (name, i) {
        entries.push({ catKey: key, name: name, value: sub[key][name], color: subcatColor(key, i) });
      });
    });

    if (!entries.length || !total) {
      listWrap.innerHTML = '<div class="hint">データがありません</div>';
      return;
    }

    var svgNS = "http://www.w3.org/2000/svg";
    var size = 180, cx = size / 2, cy = size / 2, r = size / 2 - 4;
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "サブカテゴリ別支出の割合");

    if (entries.length === 1) {
      var only = entries[0];
      var circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", cx); circle.setAttribute("cy", cy); circle.setAttribute("r", r);
      circle.setAttribute("fill", only.color);
      circle.tabIndex = 0;
      wireTooltip(circle, function () { return [{ color: only.color, value: yen(only.value), label: only.name + "（" + CATS[only.catKey].label + "・100.0%）" }]; });
      svg.appendChild(circle);
    } else {
      var angle = -Math.PI / 2;
      entries.forEach(function (e) {
        var share = e.value / total;
        var sweep = share * 2 * Math.PI;
        var endAngle = angle + sweep;
        var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        var x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
        var largeArc = sweep > Math.PI ? 1 : 0;
        var d = "M" + cx + "," + cy + " L" + x1 + "," + y1 + " A" + r + "," + r + " 0 " + largeArc + " 1 " + x2 + "," + y2 + " Z";
        var path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", e.color);
        path.tabIndex = 0;
        wireTooltip(path, function () { return [{ color: e.color, value: yen(e.value), label: e.name + "（" + CATS[e.catKey].label + "・" + pct(share) + "）" }]; });
        svg.appendChild(path);
        angle = endAngle;
      });
    }
    pieWrap.appendChild(svg);

    entries.forEach(function (e) {
      var share = total ? e.value / total : 0;
      var line = document.createElement("div");
      line.className = "stat-line";
      line.innerHTML =
        '<div class="label"><span class="swatch" style="background:' + e.color + '"></span>' + e.name +
        '<span class="hint" style="margin-left:4px;">(' + CATS[e.catKey].label + ')</span></div>' +
        '<div class="value">' + yen(e.value) + '<span class="share">' + pct(share) + "</span></div>";
      listWrap.appendChild(line);
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
        var subSel = document.createElement("select");
        wireCategorySubcategorySelects(catSel, subSel);
        var saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-primary btn-sm"; saveBtn.type = "button"; saveBtn.textContent = "ルールを保存";
        saveBtn.addEventListener("click", function () {
          var kw = kwInput.value.trim();
          if (!kw) return;
          if (!catSel.value || !subSel.value) { alert("カテゴリとサブカテゴリを選択してください。"); return; }
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

  // Both selects start on an empty "-- 選択 --" placeholder so a rule can
  // never be saved with an un-chosen category silently defaulting to the
  // first option in the list (that previously caused rules to get created
  // as "固定生活費/食費" whenever a user saved without picking anything).
  function wireCategorySubcategorySelects(catSel, subSel) {
    catSel.innerHTML = "";
    var catPlaceholder = document.createElement("option");
    catPlaceholder.value = ""; catPlaceholder.textContent = "-- カテゴリを選択 --";
    catSel.appendChild(catPlaceholder);
    CAT_ORDER.forEach(function (key) { var o = document.createElement("option"); o.value = key; o.textContent = CATS[key].label; catSel.appendChild(o); });
    function fillSub() {
      subSel.innerHTML = "";
      var subPlaceholder = document.createElement("option");
      subPlaceholder.value = ""; subPlaceholder.textContent = "-- サブカテゴリを選択 --";
      subSel.appendChild(subPlaceholder);
      if (catSel.value && CATS[catSel.value]) {
        CATS[catSel.value].subs.forEach(function (s) { var o = document.createElement("option"); o.value = s; o.textContent = s; subSel.appendChild(o); });
      }
    }
    catSel.addEventListener("change", fillSub);
    fillSub();
  }

  function fillNewRuleSelects() {
    wireCategorySubcategorySelects(document.getElementById("new-rule-category"), document.getElementById("new-rule-subcategory"));
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
    renderGroupedTable();
    if (!skipTxTable) renderTransactionsTable(); else renderTransactionsTablePreserving();
  }

  // ---------- grouped-by-description classification ----------
  // Collapses repeat transactions into one row so the user classifies a
  // merchant once instead of once per occurrence. Two passes:
  //  1) exact match on "内容"
  //  2) fuzzy merge of near-duplicate descriptions (handles OCR glyph noise,
  //     e.g. "AP/MYBカンムリシンドウ" vs "AP/MYロカンムリシンドウ" where a
  //     single character was misread) using edit-distance similarity.
  function editDistance(a, b) {
    var dp = [], i, j;
    for (i = 0; i <= a.length; i++) { dp.push([i]); }
    for (j = 0; j <= b.length; j++) { dp[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }
  // Strip digits/punctuation before comparing -- we only want to compare the
  // "letters" portion of the description, not leftover numeric noise.
  function normalizeForCompare(s) {
    return String(s).replace(/[\d\s!！?？.,\-一ー\[\]（）()|｜]/g, "").toLowerCase();
  }
  function descSimilarity(a, b) {
    if (!a.length || !b.length) return 0;
    return 1 - editDistance(a, b) / Math.max(a.length, b.length);
  }
  var GROUP_FUZZY_THRESHOLD = 0.72; // similarity ratio (0-1); conservative to avoid merging genuinely different merchants
  var GROUP_FUZZY_MIN_LEN = 4;      // don't fuzzy-merge very short strings -- too easy to collide by chance

  function computeGroupedRows() {
    // Pass 1: exact match
    var exactMap = {};
    var order = [];
    transactions.forEach(function (t) {
      var key = t.description;
      if (!exactMap[key]) { exactMap[key] = { desc: key, count: 0, total: 0, category: t.category, subcategory: t.subcategory, mixed: false, isOcr: false, members: [], variants: [] }; order.push(key); }
      var g = exactMap[key];
      g.count++;
      g.total += t.amount;
      g.members.push(t);
      if (t.isOcr) g.isOcr = true;
      if (g.category !== t.category || g.subcategory !== t.subcategory) g.mixed = true;
    });
    var exactGroups = order.map(function (k) { return exactMap[k]; });
    // Largest-first, so the most common (likely cleanest) reading becomes
    // each cluster's representative label.
    exactGroups.sort(function (a, b) { return b.total - a.total; });

    // Pass 2: fuzzy-merge near-duplicates into clusters
    var clusters = [];
    var compareCache = [];
    exactGroups.forEach(function (g) {
      var normDesc = normalizeForCompare(g.desc);
      var best = null, bestSim = 0;
      if (normDesc.length >= GROUP_FUZZY_MIN_LEN) {
        for (var i = 0; i < clusters.length; i++) {
          if (compareCache[i].length < GROUP_FUZZY_MIN_LEN) continue;
          var sim = descSimilarity(normDesc, compareCache[i]);
          if (sim > bestSim) { bestSim = sim; best = clusters[i]; }
        }
      }
      if (best && bestSim >= GROUP_FUZZY_THRESHOLD) {
        best.count += g.count;
        best.total += g.total;
        best.members = best.members.concat(g.members);
        if (g.isOcr) best.isOcr = true;
        if (best.category !== g.category || best.subcategory !== g.subcategory) best.mixed = true;
        best.variants.push(g.desc);
      } else {
        clusters.push(g);
        compareCache.push(normDesc);
      }
    });
    clusters.sort(function (a, b) { return b.total - a.total; });
    return clusters;
  }

  function renderGroupedTable() {
    var tbody = document.querySelector("#grouped-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    var groups = computeGroupedRows();
    if (!groups.length) { tbody.innerHTML = '<tr><td colspan="7" class="hint">データがありません</td></tr>'; return; }
    groups.forEach(function (g, gi) {
      var groupKey = "g" + gi;
      var tr = document.createElement("tr");
      var tdDesc = document.createElement("td");
      tdDesc.textContent = g.desc;
      tdDesc.title = g.variants.length ? (g.desc + "\n（表記ゆれとしてまとめた候補: " + g.variants.join(" / ") + "）") : g.desc;
      if (g.variants.length) { var vb = document.createElement("span"); vb.className = "hint"; vb.style.marginLeft = "6px"; vb.textContent = "+表記ゆれ" + g.variants.length + "件"; tdDesc.appendChild(vb); }
      if (g.isOcr) { var ob = document.createElement("span"); ob.className = "badge badge-ocr"; ob.style.marginLeft = "6px"; ob.title = "画像認識(OCR)による読み取りを含みます"; ob.textContent = "OCR"; tdDesc.appendChild(ob); }
      var tdCount = document.createElement("td"); tdCount.className = "num"; tdCount.textContent = g.count + "件";
      var tdTotal = document.createElement("td"); tdTotal.className = "num"; tdTotal.textContent = yen(g.total);
      var tdCat = document.createElement("td");
      var sel = buildCategorySelect(g.mixed ? { category: "", subcategory: "" } : g);
      if (g.mixed) {
        var optMixed = document.createElement("option");
        optMixed.value = ""; optMixed.textContent = "(複数のカテゴリが混在)"; optMixed.selected = true;
        sel.insertBefore(optMixed, sel.firstChild);
      }
      sel.addEventListener("change", function () {
        if (!sel.value) return;
        var parts = sel.value.split("::");
        g.members.forEach(function (t) { t.category = parts[0]; t.subcategory = parts[1]; t.manual = true; });
        renderAll();
      });
      tdCat.appendChild(sel);
      var tdAction = document.createElement("td");
      var addBtn = document.createElement("button");
      addBtn.className = "btn btn-ghost btn-sm";
      addBtn.type = "button";
      addBtn.textContent = "ルール追加";
      addBtn.addEventListener("click", function () { toggleInlineRuleForGroup(tr, g, groupKey); });
      tdAction.appendChild(addBtn);

      // Resets this group's members back to rule-based classification --
      // useful after manually picking a category (which marks them
      // "manual" and makes reclassifyAll() skip them from then on, e.g.
      // after adding/editing a rule elsewhere) when the user wants this
      // group governed by the current rules again instead of staying
      // stuck on an earlier manual choice.
      var tdReclass = document.createElement("td");
      var reclassBtn = document.createElement("button");
      reclassBtn.className = "btn btn-ghost btn-sm";
      reclassBtn.type = "button";
      reclassBtn.textContent = "再分類";
      reclassBtn.title = "手動で設定したカテゴリを取り消し、現在のルールで自動分類し直します";
      reclassBtn.addEventListener("click", function () {
        g.members.forEach(function (t) {
          var r = classify(t.description);
          t.category = r.category;
          t.subcategory = r.subcategory;
          t.manual = false;
        });
        renderAll();
      });
      tdReclass.appendChild(reclassBtn);

      // Removes this group's transactions from the current session's
      // working set entirely -- for OCR noise that isn't a real
      // transaction at all (e.g. a leaked document title or page-footer
      // fragment misread as a row), which no category even applies to.
      // Non-destructive to the source data: paste-area text and the
      // uploaded file are untouched, so re-running "分類する" rebuilds
      // the full list again if this was clicked by mistake.
      var tdDelete = document.createElement("td");
      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-ghost btn-sm btn-danger";
      delBtn.type = "button";
      delBtn.textContent = "削除";
      delBtn.title = "この内容の取引をすべて一覧から削除します（取引ではないノイズ行の除去用）";
      delBtn.addEventListener("click", function () {
        if (!confirm("「" + g.desc + "」（" + g.count + "件）を一覧から削除します。よろしいですか？")) return;
        var memberIds = {};
        g.members.forEach(function (t) { memberIds[t.id] = true; });
        transactions = transactions.filter(function (t) { return !memberIds[t.id]; });
        renderAll();
      });
      tdDelete.appendChild(delBtn);

      tr.appendChild(tdDesc); tr.appendChild(tdCount); tr.appendChild(tdTotal); tr.appendChild(tdCat); tr.appendChild(tdAction); tr.appendChild(tdReclass); tr.appendChild(tdDelete);
      tbody.appendChild(tr);

      var panelRow = document.createElement("tr");
      panelRow.style.display = "none";
      panelRow.dataset.groupPanelFor = groupKey;
      var panelCell = document.createElement("td");
      panelCell.colSpan = 7;
      var panel = document.createElement("div");
      panel.className = "inline-rule-panel";
      var kwInput = document.createElement("input"); kwInput.type = "text"; kwInput.value = g.desc;
      var catSel = document.createElement("select");
      var subSel = document.createElement("select");
      wireCategorySubcategorySelects(catSel, subSel);
      var saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-primary btn-sm"; saveBtn.type = "button"; saveBtn.textContent = "ルールを保存";
      saveBtn.addEventListener("click", function () {
        var kw = kwInput.value.trim();
        if (!kw) return;
        if (!catSel.value || !subSel.value) { alert("カテゴリとサブカテゴリを選択してください。"); return; }
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

  function toggleInlineRuleForGroup(tr, g, groupKey) {
    var tbody = tr.parentElement;
    var panelRow = Array.prototype.find.call(tbody.children, function (r) { return r.dataset && r.dataset.groupPanelFor === groupKey; });
    if (!panelRow) return;
    var panel = panelRow.querySelector(".inline-rule-panel");
    var isOpen = panel.classList.contains("open");
    tbody.querySelectorAll(".inline-rule-panel.open").forEach(function (p) { p.classList.remove("open"); p.closest("tr").style.display = "none"; });
    if (!isOpen) { panel.classList.add("open"); panelRow.style.display = ""; }
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
  ["col-date", "col-desc", "col-amount"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", updatePreviewHighlight);
  });
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
    if (!cat || !sub) { alert("カテゴリとサブカテゴリを選択してください。"); return; }
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
