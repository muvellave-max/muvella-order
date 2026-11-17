/*
 * Muvella 接單系統｜共用純邏輯（Pure logic）
 *
 * 這個檔案同時用在三個地方，內容必須一模一樣：
 *   - shared/logic.js        （原始檔，Node 測試用 require）
 *   - gas/Logic.gs           （Apps Script V8，沒有模組系統，靠全域變數 MuvellaLogic）
 *   - frontend/js/logic.js   （瀏覽器，全域 MuvellaLogic；測試模式的假後端也用它）
 * 修改後請執行 tools/sync_logic.sh 複製到另外兩處；tests/copies.test.js 會檢查三份是否相同。
 *
 * 規則：不碰 DOM、不碰 Apps Script 全域物件、不連網、不讀時鐘以外的外部狀態。
 * 所有日期以 Asia/Taipei 計算（台灣沒有日光節約時間，固定 UTC+8）。
 */
var MuvellaLogic = (function () {
  'use strict';

  // ───────────────────────── 常數 ─────────────────────────

  var STATUSES = [
    '新訂單', '待付訂金', '訂金待對帳', '已付訂金', '採購中', '已採購', '缺貨待退款',
    '回台運送中', '抵台待付尾款', '尾款待對帳', '已付尾款', '已出貨／待取貨', '已完成', '已取消', '異常'
  ];
  var FINAL_STATUSES = ['已完成', '已取消'];
  var NON_FINAL_STATUSES = STATUSES.filter(function (s) { return FINAL_STATUSES.indexOf(s) < 0; });

  var MAIN_PATH = [
    '新訂單', '待付訂金', '訂金待對帳', '已付訂金', '採購中', '已採購',
    '回台運送中', '抵台待付尾款', '尾款待對帳', '已付尾款', '已出貨／待取貨', '已完成'
  ];

  var BASE_TRANSITIONS = {
    '新訂單': ['待付訂金', '已取消'],
    '待付訂金': ['訂金待對帳', '已付訂金', '已取消'],
    '訂金待對帳': ['已付訂金', '待付訂金', '已取消'],
    '已付訂金': ['採購中'],
    '採購中': ['已採購', '缺貨待退款'],
    '已採購': ['回台運送中', '缺貨待退款'],
    '缺貨待退款': ['已取消', '已採購'],
    '回台運送中': ['抵台待付尾款'],
    '抵台待付尾款': ['尾款待對帳', '已付尾款'],
    '尾款待對帳': ['已付尾款', '抵台待付尾款'],
    '已付尾款': ['已出貨／待取貨'],
    '已出貨／待取貨': ['已完成'],
    '已完成': [],
    '已取消': [],
    '異常': []
  };

  // 組出完整轉換表：任何未結案狀態 → 異常；異常 → 任何未結案狀態（店家處理後）
  var TRANSITIONS = (function () {
    var t = {};
    STATUSES.forEach(function (s) {
      var list = BASE_TRANSITIONS[s].slice();
      if (s === '異常') {
        list = NON_FINAL_STATUSES.filter(function (x) { return x !== '異常'; });
      } else if (FINAL_STATUSES.indexOf(s) < 0) {
        list.push('異常');
      }
      t[s] = list;
    });
    return t;
  })();

  // 顧客自己能做的事（伺服器端仍會檢查）
  var CUSTOMER_ACTIONS = {
    reportDeposit: { from: ['待付訂金', '訂金待對帳'], to: '訂金待對帳' },
    reportBalance: { from: ['抵台待付尾款', '尾款待對帳'], to: '尾款待對帳' },
    cancel: { from: ['新訂單', '待付訂金'], to: '已取消' }
  };

  var PRODUCT_STATUSES = ['收單中', '已截止', '已下架'];
  var PICKUPS = ['7-11', '宅配'];
  var PAYMENT_KINDS = ['訂金', '尾款'];
  var PAYMENT_RESULTS = ['相符', '金額不符', '找不到訂單', '待查'];
  var SHIP_BATCH_STATUSES = ['尚未出發', '運送中', '已抵達'];
  var BUY_BATCH_STATUSES = ['準備中', '採購中', '完成', '部分缺貨'];
  var DELIVERY_STATUSES = ['待出貨', '已出貨', '已取', '未取退回'];
  var PURCHASE_STATUSES = ['已付訂金', '採購中', '已採購'];

  var DEFAULT_SETTINGS = {
    shopName: 'Muvella',
    depositRatio: 0.5,
    bankName: '',
    bankBranch: '',
    bankAccount: '',
    bankHolder: '',
    shippingNote: '運費抵台後依實際寄送方式另計，會跟尾款一起通知你。',
    cutoffText: '每檔商品依各自的預購截止日收單，截止當天 23:59 前送出都算。',
    paymentDeadlineText: '請在下單後 2 天內完成訂金匯款並回報後五碼。',
    maxQtyPerItem: 10
  };

  var BANK_PLACEHOLDER = '（請先到設定填入收款帳號）';
  var MAX_LINES = 20;
  var TAIPEI_OFFSET_MS = 8 * 3600 * 1000;

  // ───────────────────────── 小工具 ─────────────────────────

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function isInt(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
  }

  function toNumber(v, fallback) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v.replace(/,/g, '')))) return Number(v.replace(/,/g, ''));
    return fallback;
  }

  /** 去掉控制字元並修剪前後空白（保留一般換行，用於備註） */
  function cleanText(v, keepNewlines) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    s = keepNewlines
      ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, '')
      : s.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, '');
    return s.trim();
  }

  function charLength(s) {
    // 以 Unicode code point 計算（中文一字算一）
    return Array.from ? Array.from(s).length : s.length;
  }

  /** 試算表公式注入防護：開頭是 = + - @ 的字串前面加上單引號 */
  function sheetSafe(v) {
    if (typeof v !== 'string') return v;
    if (/^[=+\-@\t\r]/.test(v)) return "'" + v;
    return v;
  }

  function formatMoney(n) {
    var v = Math.round(toNumber(n, 0));
    var neg = v < 0;
    var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + 'NT$' + s;
  }

  // ───────────────────────── 日期（Asia/Taipei） ─────────────────────────

  function taipeiDateParts(date) {
    var d = new Date(date.getTime() + TAIPEI_OFFSET_MS);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      weekday: d.getUTCDay()
    };
  }

  function taipeiYmd(date) {
    var p = taipeiDateParts(date);
    return pad(p.year, 4) + pad(p.month, 2) + pad(p.day, 2);
  }

  function formatTaipeiDate(date) {
    var p = taipeiDateParts(date);
    return pad(p.year, 4) + '-' + pad(p.month, 2) + '-' + pad(p.day, 2);
  }

  function formatTaipeiDateTime(date) {
    var p = taipeiDateParts(date);
    return formatTaipeiDate(date) + ' ' + pad(p.hour, 2) + ':' + pad(p.minute, 2) + ':' + pad(p.second, 2);
  }

  /** 解析 YYYY-MM-DD，回傳 {year, month, day} 或 null（含檢查日期是否真實存在） */
  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { year: y, month: mo, day: d };
  }

  /** 台北時間某日 00:00:00 的 UTC 毫秒 */
  function taipeiDayStartMs(ymdStr) {
    var p = parseYmd(ymdStr);
    if (!p) return NaN;
    return Date.UTC(p.year, p.month - 1, p.day) - TAIPEI_OFFSET_MS;
  }

  /** 台北時間某日 23:59:59.999 的 UTC 毫秒（截止日當天整天都可下單） */
  function deadlineEndMs(ymdStr) {
    var start = taipeiDayStartMs(ymdStr);
    return isNaN(start) ? NaN : start + 24 * 3600 * 1000 - 1;
  }

  function isPastDeadline(deadline, now) {
    var end = deadlineEndMs(deadline);
    if (isNaN(end)) return true; // 截止日無效時一律當作已截止，避免誤收單
    return now.getTime() > end;
  }

  /** 距截止還有幾天（以台北日期計；今天截止 = 0；已過 = 負數） */
  function daysUntilDeadline(deadline, now) {
    var start = taipeiDayStartMs(deadline);
    if (isNaN(start)) return null;
    var today = taipeiDayStartMs(formatTaipeiDate(now));
    return Math.round((start - today) / (24 * 3600 * 1000));
  }

  function weekdayLabel(ymdStr) {
    var p = parseYmd(ymdStr);
    if (!p) return '';
    var w = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    return '週' + ['日', '一', '二', '三', '四', '五', '六'][w];
  }

  // ───────────────────────── 編號 ─────────────────────────

  function formatProductId(n) { return 'P-' + pad(n, 4); }
  function formatCustomerId(n) { return 'C-' + pad(n, 4); }
  function formatPaymentId(n) { return 'PAY-' + pad(n, 4); }

  /** dateYYYYMMDD 可以是 '20261117' 字串或 Date（以台北日期） */
  function formatOrderId(dateYYYYMMDD, seq) {
    var ymd = dateYYYYMMDD instanceof Date ? taipeiYmd(dateYYYYMMDD) : String(dateYYYYMMDD).replace(/-/g, '');
    return 'MV-' + ymd + '-' + pad(seq, 3);
  }

  function ymdCompact(d) {
    if (d instanceof Date) return taipeiYmd(d);
    var p = parseYmd(d);
    if (p) return pad(p.year, 4) + pad(p.month, 2) + pad(p.day, 2);
    var s = String(d || '').replace(/-/g, '');
    return /^\d{8}$/.test(s) ? s : '';
  }

  function formatBuyBatch(deadlineDate) {
    var c = ymdCompact(deadlineDate);
    return c ? 'BUY-' + c : '';
  }

  function formatShipBatch(date) {
    var c = ymdCompact(date);
    return c ? 'SHIP-' + c : '';
  }

  // ───────────────────────── 狀態 ─────────────────────────

  function isStatus(s) { return STATUSES.indexOf(s) >= 0; }
  function isFinal(s) { return FINAL_STATUSES.indexOf(s) >= 0; }

  function canTransition(from, to) {
    if (!isStatus(from) || !isStatus(to) || from === to) return false;
    return TRANSITIONS[from].indexOf(to) >= 0;
  }

  function nextStatuses(from) {
    return isStatus(from) ? TRANSITIONS[from].slice() : [];
  }

  function customerCan(action, status) {
    var a = CUSTOMER_ACTIONS[action];
    return !!a && a.from.indexOf(status) >= 0;
  }

  var CUSTOMER_LABELS = {
    '新訂單': '已收到訂單',
    '待付訂金': '等你付訂金',
    '訂金待對帳': '訂金對帳中',
    '已付訂金': '訂金已收到',
    '採購中': '採購中',
    '已採購': '已買到',
    '缺貨待退款': '沒買到，準備退款',
    '回台運送中': '回台運送中',
    '抵台待付尾款': '已到台灣，等你付尾款',
    '尾款待對帳': '尾款對帳中',
    '已付尾款': '尾款已收到，準備出貨',
    '已出貨／待取貨': '已出貨／待取貨',
    '已完成': '已完成',
    '已取消': '已取消',
    '異常': '需要確認，店家會聯絡你'
  };

  var CUSTOMER_HINTS = {
    '新訂單': '店家確認後會通知你付訂金。',
    '待付訂金': '轉帳後在這裡回報帳號後五碼。',
    '訂金待對帳': '已收到你的回報，店家核對中。',
    '已付訂金': '截止後會去採購。',
    '採購中': '正在當地採購。',
    '已採購': '等待併運回台。',
    '缺貨待退款': '這次沒買到，店家會退款給你。',
    '回台運送中': '貨正在回台灣的路上。',
    '抵台待付尾款': '貨已到台灣，付完尾款就寄出。',
    '尾款待對帳': '已收到你的回報，店家核對中。',
    '已付尾款': '準備寄出或通知取件。',
    '已出貨／待取貨': '已寄出，請留意取件通知。',
    '已完成': '謝謝你！',
    '已取消': '這筆訂單已取消。',
    '異常': '店家會在聊天室跟你聯絡。'
  };

  function customerStatusLabel(status) {
    return CUSTOMER_LABELS[status] || '處理中';
  }

  function customerStatusHint(status) {
    return CUSTOMER_HINTS[status] || '';
  }

  var TIMELINE = ['待付訂金', '訂金待對帳', '已付訂金', '採購中', '已採購', '回台運送中',
    '抵台待付尾款', '尾款待對帳', '已付尾款', '已出貨／待取貨', '已完成'];

  /**
   * 顧客時間軸。history（選填）= [{to, time}]，用來在缺貨、取消、異常時找出最後走到的主線步驟。
   * 回傳 { steps:[{status,label,state:'done'|'now'|'todo',time}], side:null|{status,label,hint} }
   */
  function timelineSteps(status, history) {
    history = history || [];
    var times = {};
    history.forEach(function (h) { if (h && h.to) times[h.to] = h.time || ''; });
    var idx = TIMELINE.indexOf(status);
    if (status === '新訂單') idx = -1;
    var side = null;
    if (idx < 0 && status !== '新訂單') {
      side = { status: status, label: customerStatusLabel(status), hint: customerStatusHint(status) };
      // 找歷史中最後一個主線狀態
      idx = -1;
      for (var i = history.length - 1; i >= 0; i--) {
        var j = TIMELINE.indexOf(history[i] && history[i].to);
        if (j >= 0) { idx = j; break; }
      }
    }
    var steps = TIMELINE.map(function (s, i) {
      var state;
      if (side) state = i <= idx ? 'done' : 'todo';
      else state = i < idx ? 'done' : (i === idx ? (s === '已完成' ? 'done' : 'now') : 'todo');
      return { status: s, label: customerStatusLabel(s), state: state, time: times[s] || '' };
    });
    return { steps: steps, side: side };
  }

  // ───────────────────────── 商品 ─────────────────────────

  function parseVariants(v) {
    if (Array.isArray(v)) return v.map(function (x) { return cleanText(x); }).filter(Boolean);
    var s = cleanText(v, true);
    if (!s) return [];
    var seen = {};
    return s.split(/[\n／\/,，、]+/).map(function (x) { return x.trim(); }).filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }

  function parseYesNo(v) {
    if (v === true) return true;
    var s = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
    return s === '是' || s === 'true' || s === 'y' || s === 'yes' || s === '1';
  }

  function validRatio(r) {
    return typeof r === 'number' && isFinite(r) && r > 0 && r <= 1;
  }

  function settingsWithDefaults(settings) {
    var out = {};
    var k;
    for (k in DEFAULT_SETTINGS) if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k)) out[k] = DEFAULT_SETTINGS[k];
    settings = settings || {};
    for (k in settings) {
      if (!Object.prototype.hasOwnProperty.call(settings, k)) continue;
      if (settings[k] === undefined || settings[k] === null) continue;
      if (settings[k] === '' && typeof DEFAULT_SETTINGS[k] === 'number') continue;
      out[k] = settings[k];
    }
    var r = toNumber(out.depositRatio, NaN);
    out.depositRatio = validRatio(r) ? r : DEFAULT_SETTINGS.depositRatio;
    var q = toNumber(out.maxQtyPerItem, NaN);
    out.maxQtyPerItem = isInt(q) && q >= 1 && q <= 99 ? q : DEFAULT_SETTINGS.maxQtyPerItem;
    if (!cleanText(out.shopName)) out.shopName = DEFAULT_SETTINGS.shopName;
    return out;
  }

  function effectiveDepositRatio(product, settings) {
    var r = toNumber(product && product.depositRatio, NaN);
    if (validRatio(r)) return r;
    return settingsWithDefaults(settings).depositRatio;
  }

  /** 能不能下單：回傳 {ok, reason} */
  function productOrderable(product, now) {
    if (!product) return { ok: false, reason: '找不到這個商品' };
    if (product.status !== '收單中') return { ok: false, reason: '「' + product.name + '」目前沒有開放收單' };
    if (product.startDate && parseYmd(product.startDate) && now.getTime() < taipeiDayStartMs(product.startDate)) {
      return { ok: false, reason: '「' + product.name + '」還沒開始收單' };
    }
    if (isPastDeadline(product.deadline, now)) return { ok: false, reason: '「' + product.name + '」已過預購截止日' };
    return { ok: true, reason: '' };
  }

  /** 給顧客看的商品欄位（不含店家備註、來源價等） */
  function publicProduct(product, settings, now) {
    var ratio = effectiveDepositRatio(product, settings);
    return {
      id: product.id,
      name: product.name,
      variants: parseVariants(product.variants),
      price: toNumber(product.price, 0),
      deadline: product.deadline,
      daysLeft: daysUntilDeadline(product.deadline, now),
      arrivalNote: product.arrivalNote || '',
      homeDeliveryOnly: parseYesNo(product.homeDeliveryOnly),
      pickupNote: product.pickupNote || '',
      depositRatio: ratio,
      depositEstimate: Math.ceil(toNumber(product.price, 0) * ratio),
      description: product.description || '',
      imageUrl: safeImageUrl(product.imageUrl)
    };
  }

  function catalogFor(products, settings, now) {
    return (products || []).filter(function (p) { return productOrderable(p, now).ok; })
      .map(function (p) { return publicProduct(p, settings, now); })
      .sort(function (a, b) { return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : (a.id < b.id ? -1 : 1); });
  }

  function safeImageUrl(u) {
    var s = cleanText(u);
    if (!s) return '';
    if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
    if (/^assets\/[A-Za-z0-9_\-\/.]+$/.test(s) && s.indexOf('..') < 0) return s;
    return '';
  }

  /** 後台新增／編輯商品的驗證 */
  function validateProductInput(p) {
    p = p || {};
    var errors = [];
    var out = {};
    out.name = cleanText(p.name);
    if (!out.name || charLength(out.name) > 60) errors.push('商品名稱必填，最多 60 字');
    out.variants = parseVariants(p.variants);
    if (out.variants.length > 20) errors.push('規格選項最多 20 個');
    out.variants.forEach(function (v) { if (charLength(v) > 20) errors.push('規格「' + v + '」太長（最多 20 字）'); });
    var price = toNumber(p.price, NaN);
    if (!isInt(price) || price <= 0 || price > 1000000) errors.push('單價要是正整數（台幣）');
    out.price = price;
    out.deadline = cleanText(p.deadline);
    if (!parseYmd(out.deadline)) errors.push('預購截止日格式要是 YYYY-MM-DD');
    out.startDate = cleanText(p.startDate);
    if (out.startDate && !parseYmd(out.startDate)) errors.push('預購開始日格式要是 YYYY-MM-DD');
    if (out.startDate && parseYmd(out.deadline) && out.startDate > out.deadline) errors.push('預購開始日不能晚於截止日');
    out.status = cleanText(p.status) || '收單中';
    if (PRODUCT_STATUSES.indexOf(out.status) < 0) errors.push('商品狀態只能是：' + PRODUCT_STATUSES.join('、'));
    out.homeDeliveryOnly = parseYesNo(p.homeDeliveryOnly);
    var rawRatio = p.depositRatio;
    if (rawRatio === '' || rawRatio === null || rawRatio === undefined) {
      out.depositRatio = '';
    } else {
      var r = toNumber(rawRatio, NaN);
      if (!validRatio(r)) errors.push('訂金比例要介於 0 到 1 之間（例如 0.3），或留空用預設');
      out.depositRatio = r;
    }
    out.imageUrl = cleanText(p.imageUrl);
    if (out.imageUrl && !safeImageUrl(out.imageUrl)) errors.push('圖片網址要以 https:// 開頭');
    if (charLength(out.imageUrl) > 500) errors.push('圖片網址太長');
    var limits = { arrivalNote: [100, '預計到貨說明'], pickupNote: [30, '取件限制說明'], description: [500, '公開說明'], note: [500, '備註'], sourcePrice: [60, '幣別與來源參考價'] };
    Object.keys(limits).forEach(function (k) {
      out[k] = cleanText(p[k], k === 'description' || k === 'note');
      if (charLength(out[k]) > limits[k][0]) errors.push(limits[k][1] + '最多 ' + limits[k][0] + ' 字');
    });
    return errors.length ? { ok: false, errors: errors } : { ok: true, value: out };
  }

  // ───────────────────────── 計價 ─────────────────────────

  /**
   * 依商品表重新計價。items 只取 productId / variant / qty，任何前端送來的價格一律忽略。
   */
  function computeOrder(args) {
    args = args || {};
    var items = args.items;
    var products = args.products || [];
    var settings = settingsWithDefaults(args.settings);
    var now = args.now instanceof Date ? args.now : new Date();
    var pickup = args.pickup;
    var errors = [];
    var maxQty = settings.maxQtyPerItem;

    if (!Array.isArray(items) || items.length === 0) return { ok: false, errors: ['購物車是空的'] };
    if (items.length > MAX_LINES) return { ok: false, errors: ['一次最多 ' + MAX_LINES + ' 個品項'] };
    if (PICKUPS.indexOf(pickup) < 0) errors.push('請選擇取件方式（7-11 或宅配）');

    var byId = {};
    products.forEach(function (p) { if (p && p.id) byId[p.id] = p; });

    var merged = [];
    var index = {};
    items.forEach(function (it) {
      it = it || {};
      var pid = cleanText(it.productId);
      var variant = cleanText(it.variant);
      var qty = typeof it.qty === 'string' ? toNumber(it.qty, NaN) : it.qty;
      var product = byId[pid];
      if (!product) { errors.push('找不到商品 ' + (pid || '（空白）')); return; }
      var ok = productOrderable(product, now);
      if (!ok.ok) { errors.push(ok.reason); return; }
      var variants = parseVariants(product.variants);
      if (variants.length ? variants.indexOf(variant) < 0 : variant !== '') {
        errors.push('「' + product.name + '」沒有「' + (variant || '（未選）') + '」這個規格');
        return;
      }
      if (!isInt(qty) || qty < 1 || qty > maxQty) {
        errors.push('「' + product.name + '」數量要是 1 到 ' + maxQty + ' 的整數');
        return;
      }
      var price = toNumber(product.price, NaN);
      if (!isInt(price) || price <= 0) { errors.push('「' + product.name + '」價格尚未設定，暫時不能下單'); return; }
      var key = pid + '\u0000' + variant;
      if (index[key] !== undefined) {
        merged[index[key]].qty += qty;
      } else {
        index[key] = merged.length;
        merged.push({ product: product, productId: pid, variant: variant, qty: qty, price: price });
      }
    });

    merged.forEach(function (m) {
      if (m.qty > maxQty) errors.push('「' + m.product.name + '」合計數量不能超過 ' + maxQty);
    });

    if (PICKUPS.indexOf(pickup) >= 0 && pickup !== '宅配') {
      merged.forEach(function (m) {
        if (parseYesNo(m.product.homeDeliveryOnly)) errors.push('「' + m.product.name + '」僅能宅配，請改選宅配');
      });
    }

    if (errors.length) return { ok: false, errors: dedupe(errors) };

    var total = 0, deposit = 0;
    var lines = merged.map(function (m) {
      var ratio = effectiveDepositRatio(m.product, settings);
      var subtotal = m.price * m.qty;
      var dep = Math.ceil(subtotal * ratio - 1e-9);
      total += subtotal;
      deposit += dep;
      return {
        productId: m.productId,
        name: m.product.name,
        variant: m.variant,
        qty: m.qty,
        unitPrice: m.price,
        subtotal: subtotal,
        depositRatio: ratio,
        deposit: dep,
        deadline: m.product.deadline,
        buyBatch: formatBuyBatch(m.product.deadline),
        homeDeliveryOnly: parseYesNo(m.product.homeDeliveryOnly)
      };
    });
    return { ok: true, lines: lines, total: total, deposit: deposit, balanceBeforeShipping: total - deposit };
  }

  function dedupe(arr) {
    var seen = {};
    return arr.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; });
  }

  /** 尾款 = 商品總額 − 已收訂金 + 運費 − 退款；不會是負數 */
  function computeBalance(order) {
    order = order || {};
    var v = toNumber(order.total, 0) - toNumber(order.depositPaid, 0) + toNumber(order.shippingFee, 0) - toNumber(order.refund, 0);
    return v > 0 ? Math.round(v) : 0;
  }

  /** 尾款還沒付的部分 */
  function balanceOutstanding(order) {
    var v = computeBalance(order) - toNumber(order && order.balancePaid, 0);
    return v > 0 ? v : 0;
  }

  function summarizeItems(lines) {
    return (lines || []).map(function (l) {
      return l.name + (l.variant ? '（' + l.variant + '）' : '') + ' × ' + l.qty;
    }).join('、');
  }

  // ───────────────────────── 顧客輸入 ─────────────────────────

  function normalizePhone(s) {
    return cleanText(s).replace(/[\s\-－‐()（）]/g, '');
  }

  function validateCustomerInput(input) {
    input = input || {};
    var errors = [];
    var out = {};
    out.name = cleanText(input.name);
    var n = charLength(out.name);
    if (n < 1 || n > 20) errors.push('稱呼請填 1 到 20 個字');
    out.phone = normalizePhone(input.phone);
    if (!/^09\d{8}$/.test(out.phone)) errors.push('手機請填 09 開頭的 10 碼數字');
    out.pickup = cleanText(input.pickup);
    out.storeName = '';
    out.storeId = '';
    out.address = '';
    if (out.pickup === '7-11') {
      out.storeName = cleanText(input.storeName);
      var sn = charLength(out.storeName);
      if (sn < 1 || sn > 30) errors.push('請填取件的 7-11 門市名稱（最多 30 字）');
      out.storeId = cleanText(input.storeId).replace(/\s/g, '');
      if (out.storeId && !/^\d{1,8}$/.test(out.storeId)) errors.push('門市店號只能是數字（最多 8 碼）');
    } else if (out.pickup === '宅配') {
      out.address = cleanText(input.address);
      var an = charLength(out.address);
      if (an < 5 || an > 100) errors.push('收件地址請填 5 到 100 個字');
    } else {
      errors.push('請選擇取件方式（7-11 或宅配）');
    }
    out.note = cleanText(input.note, true);
    if (charLength(out.note) > 200) errors.push('備註最多 200 字');
    out.agree = input.agree === true;
    if (!out.agree) errors.push('請勾選「我了解這是預購」');
    return errors.length ? { ok: false, errors: errors } : { ok: true, value: out };
  }

  function validateLast5(s) {
    return typeof s === 'string' && /^\d{5}$/.test(s);
  }

  // ───────────────────────── 對帳 ─────────────────────────

  /** 依金額與款項類別找可能的訂單；顧客回報的後五碼相同的排前面 */
  function suggestPaymentMatches(payment, orders) {
    payment = payment || {};
    var amount = toNumber(payment.amount, NaN);
    var last5 = String(payment.last5 || '');
    var kind = payment.kind;
    if (!isFinite(amount)) return [];
    var list = (orders || []).filter(function (o) {
      if (kind === '訂金') {
        return (o.status === '待付訂金' || o.status === '訂金待對帳') && toNumber(o.deposit, NaN) === amount;
      }
      if (kind === '尾款') {
        return (o.status === '抵台待付尾款' || o.status === '尾款待對帳') && balanceOutstanding(o) === amount;
      }
      return false;
    });
    function reported(o) { return kind === '訂金' ? String(o.depositLast5 || '') : String(o.balanceLast5 || ''); }
    return list.map(function (o, i) {
      return { order: o, last5Match: !!last5 && reported(o) === last5, i: i };
    }).sort(function (a, b) {
      if (a.last5Match !== b.last5Match) return a.last5Match ? -1 : 1;
      var sa = a.order.status.indexOf('待對帳') >= 0, sb = b.order.status.indexOf('待對帳') >= 0;
      if (sa !== sb) return sa ? -1 : 1;
      return a.i - b.i;
    }).map(function (x) { return x.order; });
  }

  /**
   * 店家登錄一筆款項對訂單的影響。回傳 {ok, fields, toStatus|null, error}
   * 只有核對結果「相符」才會入帳；「金額不符」會把訂單標成異常。
   */
  function paymentEffect(order, payment) {
    var kind = payment.kind;
    var amount = toNumber(payment.amount, NaN);
    var result = payment.result;
    if (PAYMENT_KINDS.indexOf(kind) < 0) return { ok: false, error: '款項類別只能是訂金或尾款' };
    if (!isInt(amount) || amount <= 0) return { ok: false, error: '金額要是正整數' };
    if (PAYMENT_RESULTS.indexOf(result) < 0) return { ok: false, error: '核對結果不正確' };
    if (!order) {
      if (result === '相符' || result === '金額不符') return { ok: false, error: '「相符」或「金額不符」需要選擇對應訂單' };
      return { ok: true, fields: {}, toStatus: null };
    }
    var fields = {};
    var to = null;
    if (result === '相符') {
      if (kind === '訂金') {
        if (['待付訂金', '訂金待對帳'].indexOf(order.status) < 0) return { ok: false, error: '這筆訂單目前不是等訂金的狀態（' + order.status + '）' };
        fields.depositPaid = toNumber(order.depositPaid, 0) + amount;
        to = '已付訂金';
      } else {
        if (['抵台待付尾款', '尾款待對帳'].indexOf(order.status) < 0) return { ok: false, error: '這筆訂單目前不是等尾款的狀態（' + order.status + '）' };
        fields.balancePaid = toNumber(order.balancePaid, 0) + amount;
        to = '已付尾款';
      }
    } else if (result === '金額不符') {
      to = canTransition(order.status, '異常') ? '異常' : null;
    }
    return { ok: true, fields: fields, toStatus: to };
  }

  // ───────────────────────── 通知稿 ─────────────────────────

  var DRAFT_TEMPLATES = {
    '請付訂金': {
      status: '待付訂金',
      text: '嗨〔稱呼〕，訂單〔訂單編號〕已幫你留了：〔品項與數量〕，商品金額〔商品總額〕元。\n' +
        '這次先收訂金〔金額〕元，請轉帳到〔銀行〕〔帳號〕，戶名〔戶名〕。\n' +
        '轉好後把帳號後五碼和轉帳時間回我，也可以在「我的訂單」裡填，對到款才算確定。\n' +
        '這是預購，〔截止日〕截止後才會去買，買不到會退款。'
    },
    '訂金已收到': {
      status: '已付訂金',
      text: '〔訂單編號〕的訂金〔金額〕元已經對到了，謝謝。\n' +
        '會在〔截止日〕截止後去採購，之後再跟你說回台和取件的時間。'
    },
    '缺貨退款': {
      status: '缺貨待退款',
      text: '〔訂單編號〕的〔品項與數量〕這次沒買到，真的抱歉。\n' +
        '會把〔金額〕元退回你的帳戶，退好再跟你說。'
    },
    '抵台請付尾款': {
      status: '抵台待付尾款',
      text: '〔訂單編號〕已經到台灣了。\n' +
        '尾款是〔金額〕元（含運費〔運費〕元），請轉帳到〔銀行〕〔帳號〕，戶名〔戶名〕，轉好後回我帳號後五碼。\n' +
        '收到後就幫你寄出，取件方式：〔取件方式〕。'
    },
    '尾款已收到_出貨': {
      status: '已出貨／待取貨',
      text: '〔訂單編號〕的尾款已經對到，謝謝。\n' +
        '已經幫你寄出：〔取件方式〕，物流單號〔物流單號〕。到了請盡快取件，有問題再跟我說。'
    },
    '已完成': {
      status: '已完成',
      text: '〔訂單編號〕看起來已經取到了。謝謝你，下次有想帶的東西再跟我說。'
    }
  };

  function pickupText(order) {
    if (!order) return '';
    if (order.pickup === '7-11') return '7-11 ' + (order.storeName || '') + (order.storeId ? '（店號 ' + order.storeId + '）' : '');
    if (order.pickup === '宅配') return '宅配';
    return order.pickup || '';
  }

  function buildNotificationDraft(templateKey, order, settings) {
    var tpl = DRAFT_TEMPLATES[templateKey];
    if (!tpl) return { ok: false, error: '沒有這個通知稿：' + templateKey };
    var raw = settings && settings.templates && typeof settings.templates[templateKey] === 'string' && settings.templates[templateKey].trim()
      ? settings.templates[templateKey] : tpl.text;
    var s = settingsWithDefaults(settings);
    order = order || {};
    var bankMissing = !cleanText(s.bankName) || !cleanText(s.bankAccount) || !cleanText(s.bankHolder);
    var amount;
    if (templateKey === '請付訂金') amount = toNumber(order.deposit, 0);
    else if (templateKey === '訂金已收到') amount = toNumber(order.depositPaid, 0) || toNumber(order.deposit, 0);
    else if (templateKey === '缺貨退款') amount = toNumber(order.refund, 0) || toNumber(order.depositPaid, 0);
    else if (templateKey === '抵台請付尾款') amount = balanceOutstanding(order);
    else amount = toNumber(order.total, 0);
    var items = order.items && order.items.length ? summarizeItems(order.items) : (order.itemsSummary || '');
    var map = {
      '訂單編號': order.id || '',
      '稱呼': order.name || '',
      '品項與數量': items,
      '品項': items,
      '金額': String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      '商品總額': String(toNumber(order.total, 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      '運費': String(toNumber(order.shippingFee, 0)),
      '銀行': bankMissing ? BANK_PLACEHOLDER : (cleanText(s.bankName) + (cleanText(s.bankBranch) ? ' ' + cleanText(s.bankBranch) : '')),
      '帳號': bankMissing ? '' : cleanText(s.bankAccount),
      '戶名': bankMissing ? BANK_PLACEHOLDER : cleanText(s.bankHolder),
      '截止日': order.deadline || '截止日',
      '取件方式': pickupText(order),
      '物流單號': order.trackingNo || '（尚未填寫）',
      '店名': s.shopName,
      '品牌': s.shopName
    };
    var text = raw.replace(/〔([^〕\]］]+)[〕\]］]/g, function (all, k) {
      return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : all;
    });
    // 銀行未設定時避免同一句重複出現兩次提示
    text = text.replace(BANK_PLACEHOLDER + '，戶名' + BANK_PLACEHOLDER, BANK_PLACEHOLDER);
    return { ok: true, text: text, templateKey: templateKey, bankMissing: bankMissing };
  }

  function suggestTemplate(status) {
    var keys = Object.keys(DRAFT_TEMPLATES);
    for (var i = 0; i < keys.length; i++) if (DRAFT_TEMPLATES[keys[i]].status === status) return keys[i];
    if (status === '已付尾款') return '尾款已收到_出貨';
    return '';
  }

  // ───────────────────────── 採購彙總 ─────────────────────────

  /**
   * 依採購批次 → 商品＋規格加總數量。只算 已付訂金／採購中／已採購 的訂單、明細狀態不是取消／缺貨的品項。
   * 回傳 [{batch, deadlines:[...], lines:[{productId, variant, name, qty, orderIds:[]}], orderIds:[]}]
   */
  function aggregatePurchase(orders, orderItems) {
    var okOrders = {};
    (orders || []).forEach(function (o) { if (PURCHASE_STATUSES.indexOf(o.status) >= 0) okOrders[o.id] = o; });
    var batches = {};
    (orderItems || []).forEach(function (it) {
      var o = okOrders[it.orderId];
      if (!o) return;
      if (it.lineStatus === '取消' || it.lineStatus === '缺貨') return;
      var batch = it.buyBatch || formatBuyBatch(it.deadline) || o.buyBatch || '未分批';
      var b = batches[batch] || (batches[batch] = { batch: batch, deadlines: [], lines: [], orderIds: [], _idx: {} });
      if (it.deadline && b.deadlines.indexOf(it.deadline) < 0) b.deadlines.push(it.deadline);
      if (b.orderIds.indexOf(o.id) < 0) b.orderIds.push(o.id);
      var key = it.productId + '\u0000' + (it.variant || '');
      var line = b._idx[key];
      if (!line) {
        line = { productId: it.productId, variant: it.variant || '', name: it.name || '', qty: 0, orderIds: [] };
        b._idx[key] = line;
        b.lines.push(line);
      }
      line.qty += toNumber(it.qty, 0);
      if (line.orderIds.indexOf(o.id) < 0) line.orderIds.push(o.id);
    });
    return Object.keys(batches).sort().map(function (k) {
      var b = batches[k];
      delete b._idx;
      b.deadlines.sort();
      b.lines.sort(function (x, y) { return x.productId < y.productId ? -1 : x.productId > y.productId ? 1 : (x.variant < y.variant ? -1 : 1); });
      return b;
    });
  }

  // ───────────────────────── 總覽統計 ─────────────────────────

  function dashboardStats(orders, products, now) {
    var counts = {};
    STATUSES.forEach(function (s) { counts[s] = 0; });
    var weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    var weekNew = 0, weekReceived = 0;
    (orders || []).forEach(function (o) {
      if (counts[o.status] !== undefined) counts[o.status]++;
      var t = parseDateTimeTaipei(o.createdAt);
      if (!isNaN(t) && t >= weekAgo) {
        weekNew++;
        weekReceived += toNumber(o.depositPaid, 0) + toNumber(o.balancePaid, 0);
      }
    });
    var upcoming = (products || []).filter(function (p) {
      return p.status === '收單中' && !isPastDeadline(p.deadline, now);
    }).map(function (p) {
      return { id: p.id, name: p.name, deadline: p.deadline, daysLeft: daysUntilDeadline(p.deadline, now), homeDeliveryOnly: parseYesNo(p.homeDeliveryOnly) };
    }).sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; });
    return {
      counts: counts,
      todo: counts['訂金待對帳'] + counts['尾款待對帳'] + counts['異常'],
      weekNew: weekNew,
      weekReceived: weekReceived,
      upcoming: upcoming
    };
  }

  /** 'YYYY-MM-DD HH:mm(:ss)' 台北時間 → UTC 毫秒 */
  function parseDateTimeTaipei(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s || '').trim());
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - TAIPEI_OFFSET_MS;
  }

  // ───────────────────────── 設定 ─────────────────────────

  function validateSettingsInput(s) {
    s = s || {};
    var errors = [];
    var out = {};
    var r = toNumber(s.depositRatio, NaN);
    if (!validRatio(r)) errors.push('預設訂金比例要介於 0 到 1 之間（例如 0.5）');
    out.depositRatio = r;
    var q = toNumber(s.maxQtyPerItem, NaN);
    if (!isInt(q) || q < 1 || q > 99) errors.push('每個品項數量上限要是 1 到 99');
    out.maxQtyPerItem = q;
    var fields = {
      shopName: [20, '店名'], bankName: [30, '收款銀行'], bankBranch: [30, '分行'], bankAccount: [30, '帳號'],
      bankHolder: [30, '戶名'], shippingNote: [200, '運費說明'], cutoffText: [200, '收單截止說明'], paymentDeadlineText: [200, '匯款期限說明']
    };
    Object.keys(fields).forEach(function (k) {
      out[k] = cleanText(s[k], k.slice(-4) === 'Note' || k.slice(-4) === 'Text');
      if (charLength(out[k]) > fields[k][0]) errors.push(fields[k][1] + '最多 ' + fields[k][0] + ' 字');
    });
    if (!out.shopName) out.shopName = DEFAULT_SETTINGS.shopName;
    if (out.bankAccount && !/^[0-9\-\s]+$/.test(out.bankAccount)) errors.push('帳號只能有數字與橫線');
    return errors.length ? { ok: false, errors: errors } : { ok: true, value: out };
  }

  function publicSettings(settings) {
    var s = settingsWithDefaults(settings);
    return {
      shopName: s.shopName,
      depositRatio: s.depositRatio,
      shippingNote: s.shippingNote,
      cutoffText: s.cutoffText,
      paymentDeadlineText: s.paymentDeadlineText,
      maxQtyPerItem: s.maxQtyPerItem
    };
  }

  function bankInfo(settings) {
    var s = settingsWithDefaults(settings);
    var missing = !cleanText(s.bankName) || !cleanText(s.bankAccount) || !cleanText(s.bankHolder);
    return missing
      ? { configured: false, bankName: BANK_PLACEHOLDER, bankBranch: '', bankAccount: BANK_PLACEHOLDER, bankHolder: BANK_PLACEHOLDER }
      : { configured: true, bankName: cleanText(s.bankName), bankBranch: cleanText(s.bankBranch), bankAccount: cleanText(s.bankAccount), bankHolder: cleanText(s.bankHolder) };
  }

  return {
    VERSION: '1.0.0',
    STATUSES: STATUSES,
    FINAL_STATUSES: FINAL_STATUSES,
    NON_FINAL_STATUSES: NON_FINAL_STATUSES,
    MAIN_PATH: MAIN_PATH,
    TRANSITIONS: TRANSITIONS,
    CUSTOMER_ACTIONS: CUSTOMER_ACTIONS,
    PRODUCT_STATUSES: PRODUCT_STATUSES,
    PICKUPS: PICKUPS,
    PAYMENT_KINDS: PAYMENT_KINDS,
    PAYMENT_RESULTS: PAYMENT_RESULTS,
    SHIP_BATCH_STATUSES: SHIP_BATCH_STATUSES,
    BUY_BATCH_STATUSES: BUY_BATCH_STATUSES,
    DELIVERY_STATUSES: DELIVERY_STATUSES,
    PURCHASE_STATUSES: PURCHASE_STATUSES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DRAFT_TEMPLATES: DRAFT_TEMPLATES,
    BANK_PLACEHOLDER: BANK_PLACEHOLDER,
    MAX_LINES: MAX_LINES,
    // 工具
    pad: pad,
    cleanText: cleanText,
    sheetSafe: sheetSafe,
    toNumber: toNumber,
    formatMoney: formatMoney,
    // 日期
    taipeiDateParts: taipeiDateParts,
    taipeiYmd: taipeiYmd,
    formatTaipeiDate: formatTaipeiDate,
    formatTaipeiDateTime: formatTaipeiDateTime,
    parseYmd: parseYmd,
    parseDateTimeTaipei: parseDateTimeTaipei,
    deadlineEndMs: deadlineEndMs,
    isPastDeadline: isPastDeadline,
    daysUntilDeadline: daysUntilDeadline,
    weekdayLabel: weekdayLabel,
    // 編號
    formatProductId: formatProductId,
    formatCustomerId: formatCustomerId,
    formatOrderId: formatOrderId,
    formatBuyBatch: formatBuyBatch,
    formatShipBatch: formatShipBatch,
    formatPaymentId: formatPaymentId,
    // 狀態
    isStatus: isStatus,
    isFinal: isFinal,
    canTransition: canTransition,
    nextStatuses: nextStatuses,
    customerCan: customerCan,
    customerStatusLabel: customerStatusLabel,
    customerStatusHint: customerStatusHint,
    timelineSteps: timelineSteps,
    // 商品
    parseVariants: parseVariants,
    parseYesNo: parseYesNo,
    settingsWithDefaults: settingsWithDefaults,
    effectiveDepositRatio: effectiveDepositRatio,
    productOrderable: productOrderable,
    publicProduct: publicProduct,
    catalogFor: catalogFor,
    safeImageUrl: safeImageUrl,
    validateProductInput: validateProductInput,
    // 計價與輸入
    computeOrder: computeOrder,
    computeBalance: computeBalance,
    balanceOutstanding: balanceOutstanding,
    summarizeItems: summarizeItems,
    normalizePhone: normalizePhone,
    validateCustomerInput: validateCustomerInput,
    validateLast5: validateLast5,
    // 對帳、通知、採購、統計、設定
    suggestPaymentMatches: suggestPaymentMatches,
    paymentEffect: paymentEffect,
    buildNotificationDraft: buildNotificationDraft,
    suggestTemplate: suggestTemplate,
    pickupText: pickupText,
    aggregatePurchase: aggregatePurchase,
    dashboardStats: dashboardStats,
    validateSettingsInput: validateSettingsInput,
    publicSettings: publicSettings,
    bankInfo: bankInfo
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MuvellaLogic;
