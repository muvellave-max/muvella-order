/* 本機範例資料適配層；不會連線到任何服務。 */
window.MuvellaMock = (() => {
'use strict';
const L=MuvellaLogic, KEY='muvella_mock_v1'; let db;
const clone=x=>JSON.parse(JSON.stringify(x));
function day(n){return L.formatTaipeiDate(new Date(Date.now()+n*86400000));}
function seed(){
 const settings=clone(L.DEFAULT_SETTINGS), products=['範例・海岸帆布袋','範例・織紋收納袋','範例・木質香氛','範例・陶瓷杯','範例・截止織品','範例・下架小物'].map((name,i)=>({id:L.formatProductId(i+1),name,variants:'沙色／海藍',price:[1280,680,980,860,550,420][i],depositRatio:i===3?0.3:'',deadline:day(i===4?-2:3+i),startDate:day(-7),status:i===5?'已下架':'收單中',homeDeliveryOnly:i===2,arrivalNote:'預計截止後三至四週抵台',description:'範例商品：為日常留一點旅行的溫度。預購品可能缺貨或延期，買不到會退款。',imageUrl:'',images:'',note:'範例後台紀錄',sourcePrice:''}));
 products.push({id:L.formatProductId(7),name:'範例・素面 Tee',variants:'顏色：白／黑／燕麥\n尺寸：S／M／L／XL+100',price:890,compareAtPrice:1290,depositRatio:'',deadline:day(9),startDate:day(-3),status:'收單中',homeDeliveryOnly:false,arrivalNote:'12 月中旬到台灣',description:'範例商品：兩組規格（顏色 × 尺寸）＋每個顏色各自的照片。點顏色會切換到該顏色的圖。',imageUrl:'assets/products/sample-tee-white.svg',images:'白｜assets/products/sample-tee-white.svg\n黑｜assets/products/sample-tee-black.svg\n燕麥｜assets/products/sample-tee-oat.svg\nassets/products/sample-tee-detail.svg',note:'範例：兩組規格',sourcePrice:'JPY 2,990'});
 const customers=Array.from({length:4},(_,i)=>({id:L.formatCustomerId(i+1),name:i===0?'範例小帆':'範例顧客'+(i+1),phone:'0912-000-00'+(i+1),lineUserId:i===0?'U_mock_customer':'U_mock_example_'+i,lineName:'範例稱呼',pickup:'宅配',address:'範例市範例路1號',storeName:'',storeId:'',createdAt:day(-8),lastOrderAt:day(0),doNotContact:false,dataStatus:'正常',note:''}));
 const states=['待付訂金','訂金待對帳','已付訂金','採購中','已採購','回台運送中','抵台待付尾款','已完成'];
 const items=[],history=[],orders=states.map((status,i)=>{const c=customers[i<2?0:1+(i%3)],p=products[i%4],calc=L.computeOrder({items:[{productId:p.id,variant:'沙色',qty:1}],products,settings,pickup:'宅配',now:new Date()}),id=L.formatOrderId(L.taipeiYmd(new Date()),i+1);items.push(...calc.lines.map(l=>({...l,orderId:id,lineStatus:'正常'})));history.push({orderId:id,time:day(-1)+' 12:00',from:'',to:status,by:'範例管理員',note:'範例狀態'});return {id,createdAt:day(-1)+' 12:00',customerId:c.id,name:c.name,phone:c.phone,lineUserId:c.lineUserId,lineName:c.lineName,status,total:calc.total,deposit:calc.deposit,depositPaid:i>1?calc.deposit:0,balance:calc.balanceBeforeShipping,balancePaid:i===7?calc.balanceBeforeShipping:0,shippingFee:0,refund:0,pickup:'宅配',address:c.address,storeName:'',storeId:'',deadline:p.deadline,buyBatch:calc.lines[0].buyBatch,shipBatch:i===5?L.formatShipBatch(day(5)):'',trackingNo:i===7?'EXAMPLE-0001':'',depositLast5:i===1?'12345':'',balanceLast5:'',itemsSummary:L.summarizeItems(calc.lines),customerNote:'範例訂單',adminNote:'',updatedAt:day(0)};});
 return {tables:{'商品':products,'顧客':customers,'訂單':orders,'訂單明細':items,'狀態紀錄':history,'匯款對帳':[],'採購明細':[],'採購批次':[],'台灣配送':[],'回台批次':[{id:L.formatShipBatch(day(5)),departDate:day(0),arriveDate:day(5),status:'運送中',note:'範例併運紀錄',count:1}]},settings,counters:{'商品':6,'顧客':4,['訂單-'+L.taipeiYmd(new Date())]:8}};
}
function dbAll_(t){return (db.tables[t]||[]).map((x,i)=>({...x,_row:i+2}));}
function dbFind_(t,k,v){return dbAll_(t).find(x=>x[k]===v)||null;}
function dbUpdateRow_(t,row,patch){Object.assign(db.tables[t][row-2],clone(patch));}
function dbAppend_(t,v){(db.tables[t]||(db.tables[t]=[])).push(clone(v));}
function dbNextCounter_(k){return db.counters[k]=(db.counters[k]||0)+1;}
function dbReset_(){}
function stripRow_(x){const o={...x};delete o._row;return o;}
function getSettings_(){return db.settings;}
function saveSettings_(v){Object.assign(db.settings,v);}
const SETTINGS_ROWS=Object.keys(L.DEFAULT_SETTINGS).map(k=>[k,k]);
function requireAdmin(){} function adminLabel_(){return '範例管理員';}
function appError_(code,message){return Object.assign(new Error(message),{appCode:code,appMessage:message});}
function routes_() {
  return {
    getCatalog: { fn: getCatalog },
    getProduct: { fn: getProduct },
    getMe: { fn: getMe, auth: true },
    placeOrder: { fn: placeOrder, auth: true, write: true },
    getMyOrders: { fn: getMyOrders, auth: true },
    reportPayment: { fn: reportPayment, auth: true, write: true },
    cancelMyOrder: { fn: cancelMyOrder, auth: true, write: true },

    adminDashboard: { fn: adminDashboard, auth: true, admin: true },
    adminListProducts: { fn: adminListProducts, auth: true, admin: true },
    adminSaveProduct: { fn: adminSaveProduct, auth: true, admin: true, write: true },
    adminUploadImage: { fn: function () { var pics = ['assets/products/sample-tee-white.svg', 'assets/products/sample-tee-black.svg', 'assets/products/sample-tee-oat.svg', 'assets/products/sample-tee-detail.svg']; db.uploadCount = (db.uploadCount || 0) + 1; return { fileId: 'mock', name: 'mock.jpg', url: pics[(db.uploadCount - 1) % pics.length] }; }, auth: true, admin: true },
    adminListOrders: { fn: adminListOrders, auth: true, admin: true },
    adminGetOrder: { fn: adminGetOrder, auth: true, admin: true },
    adminUpdateOrderStatus: { fn: adminUpdateOrderStatus, auth: true, admin: true, write: true },
    adminRecordPayment: { fn: adminRecordPayment, auth: true, admin: true, write: true },
    adminSetShipping: { fn: adminSetShipping, auth: true, admin: true, write: true },
    adminSetNote: { fn: adminSetNote, auth: true, admin: true, write: true },
    adminPurchaseList: { fn: adminPurchaseList, auth: true, admin: true },
    adminSavePurchaseRecord: { fn: adminSavePurchaseRecord, auth: true, admin: true, write: true },
    adminListShipBatches: { fn: adminListShipBatches, auth: true, admin: true },
    adminSaveShipBatch: { fn: adminSaveShipBatch, auth: true, admin: true, write: true },
    adminAssignShipBatch: { fn: adminAssignShipBatch, auth: true, admin: true, write: true },
    adminMarkShipArrived: { fn: adminMarkShipArrived, auth: true, admin: true, write: true },
    adminListCustomers: { fn: adminListCustomers, auth: true, admin: true },
    adminUpdateCustomer: { fn: adminUpdateCustomer, auth: true, admin: true, write: true },
    adminAnonymizeCustomer: { fn: adminAnonymizeCustomer, auth: true, admin: true, write: true },
    adminGetSettings: { fn: adminGetSettings, auth: true, admin: true },
    adminSaveSettings: { fn: adminSaveSettings, auth: true, admin: true, write: true },
    adminDraft: { fn: adminDraft, auth: true, admin: true }
  };
}

function validationError_(errors) {
  var e = appError_('INVALID', errors[0] || '資料不正確');
  e.appErrors = errors;
  return e;
}

function nowText_() {
  return MuvellaLogic.formatTaipeiDateTime(new Date());
}

/** 共用：寫狀態紀錄並更新訂單狀態（呼叫前必須已檢查 canTransition） */
function changeStatus_(order, to, by, note, extraPatch) {
  var patch = extraPatch || {};
  patch.status = to;
  patch.updatedAt = nowText_();
  dbUpdateRow_('訂單', order._row, patch);
  dbAppend_('狀態紀錄', { time: patch.updatedAt, orderId: order.id, from: order.status, to: to, by: by, note: note || '' });
}

function orderItems_(orderId) {
  return dbAll_('訂單明細').filter(function (it) { return it.orderId === orderId; }).map(stripRow_);
}

function orderHistory_(orderId) {
  return dbAll_('狀態紀錄').filter(function (h) { return h.orderId === orderId; }).map(stripRow_);
}
/**
 * Customer.gs｜顧客端動作
 *
 * 身分一律來自伺服器驗證過的 LINE ID token（user.userId），不採用前端送來的任何使用者 ID、價格或金額。
 */
var PLACE_ORDER_LIMIT = 10;          // 每位顧客
var PLACE_ORDER_WINDOW_SEC = 600;    // 10 分鐘內最多 10 筆

function getCatalog(user, payload) {
  var now = new Date();
  var settings = getSettings_();
  return {
    products: MuvellaLogic.catalogFor(dbAll_('商品'), settings, now),
    settings: MuvellaLogic.publicSettings(settings),
    today: MuvellaLogic.formatTaipeiDate(now)
  };
}

function getProduct(user, payload) {
  var id = MuvellaLogic.cleanText(payload.id);
  var now = new Date();
  var p = dbFind_('商品', 'id', id);
  if (!p || !MuvellaLogic.productOrderable(p, now).ok) throw appError_('NOT_FOUND', '這個商品目前沒有開放收單');
  var settings = getSettings_();
  return { product: MuvellaLogic.publicProduct(p, settings, now), settings: MuvellaLogic.publicSettings(settings) };
}

function findCustomerByLine_(userId) {
  var all = dbAll_('顧客');
  for (var i = 0; i < all.length; i++) {
    if (all[i].lineUserId === userId && all[i].dataStatus !== '已刪除') return all[i];
  }
  return null;
}

function getMe(user, payload) {
  var c = findCustomerByLine_(user.userId);
  return {
    me: c ? {
      customerId: c.id, name: c.name, phone: c.phone, pickup: c.pickup,
      storeName: c.storeName, storeId: c.storeId, address: c.address, lineName: user.name
    } : { customerId: '', name: '', phone: '', pickup: '', storeName: '', storeId: '', address: '', lineName: user.name }
  };
}

function rateLimit_(userId) {
 const key='下單次數-'+userId, now=Date.now();
 const timestamps=(db.limits&&db.limits[key]||[]).filter(t=>now-t<600000);
 if(timestamps.length>=10)throw appError_('RATE_LIMIT','短時間內送出太多筆訂單，請稍後再試');
 if(!db.limits)db.limits={};db.limits[key]=timestamps.concat(now);
}

/** 給顧客看的訂單（不含店家備註、LINE 使用者 ID） */
function customerOrderView_(o, items, history) {
  return {
    id: o.id, createdAt: o.createdAt, status: o.status,
    statusLabel: MuvellaLogic.customerStatusLabel(o.status),
    statusHint: MuvellaLogic.customerStatusHint(o.status),
    total: o.total, deposit: o.deposit, depositPaid: o.depositPaid,
    balance: MuvellaLogic.computeBalance(o), balanceOutstanding: MuvellaLogic.balanceOutstanding(o), balancePaid: o.balancePaid,
    shippingFee: o.shippingFee, refund: o.refund,
    pickup: o.pickup, storeName: o.storeName, storeId: o.storeId, address: o.address,
    name: o.name, phone: o.phone,
    deadline: o.deadline, shipBatch: o.shipBatch, trackingNo: o.trackingNo,
    depositLast5: o.depositLast5, balanceLast5: o.balanceLast5, customerNote: o.customerNote,
    items: (items || []).map(function (it) {
      return { productId: it.productId, name: it.name, variant: it.variant, qty: it.qty, unitPrice: it.unitPrice, subtotal: it.subtotal, deposit: it.deposit, lineStatus: it.lineStatus };
    }),
    history: (history || []).map(function (h) { return { to: h.to, time: h.time }; }),
    canReportDeposit: MuvellaLogic.customerCan('reportDeposit', o.status),
    canReportBalance: MuvellaLogic.customerCan('reportBalance', o.status),
    canCancel: MuvellaLogic.customerCan('cancel', o.status)
  };
}

function placeOrder(user, payload) {
  rateLimit_(user.userId);
  var now = new Date();
  var check = MuvellaLogic.validateCustomerInput({
    name: payload.name, phone: payload.phone, pickup: payload.pickup, storeName: payload.storeName,
    storeId: payload.storeId, address: payload.address, note: payload.note, agree: payload.agree
  });
  if (!check.ok) throw validationError_(check.errors);
  var input = check.value;

  var items = Array.isArray(payload.items) ? payload.items.slice(0, MuvellaLogic.MAX_LINES + 1).map(function (it) {
    it = it || {};
    return { productId: it.productId, variant: it.variant, qty: it.qty }; // 只取這三個欄位，價格一律從商品表算
  }) : [];
  var settings = getSettings_();
  var calc = MuvellaLogic.computeOrder({ items: items, products: dbAll_('商品'), settings: settings, pickup: input.pickup, now: now });
  if (!calc.ok) throw validationError_(calc.errors);

  var nowText = MuvellaLogic.formatTaipeiDateTime(now);
  var ymd = MuvellaLogic.taipeiYmd(now);

  // 顧客：依驗證過的 LINE 使用者 ID 找，沒有就建立
  var customer = findCustomerByLine_(user.userId);
  var customerId;
  var custPatch = {
    name: input.name, phone: input.phone, lineName: user.name, pickup: input.pickup,
    storeName: input.storeName, storeId: input.storeId, address: input.address, lastOrderAt: nowText
  };
  if (customer) {
    customerId = customer.id;
    dbUpdateRow_('顧客', customer._row, custPatch);
  } else {
    customerId = MuvellaLogic.formatCustomerId(dbNextCounter_('顧客'));
    custPatch.id = customerId;
    custPatch.lineUserId = user.userId;
    custPatch.createdAt = nowText;
    custPatch.doNotContact = false;
    custPatch.dataStatus = '正常';
    custPatch.note = '';
    dbAppend_('顧客', custPatch);
  }

  var orderId = MuvellaLogic.formatOrderId(ymd, dbNextCounter_('訂單-' + ymd));
  var deadlines = calc.lines.map(function (l) { return l.deadline; }).sort();
  var batches = [];
  calc.lines.forEach(function (l) { if (batches.indexOf(l.buyBatch) < 0) batches.push(l.buyBatch); });

  var order = {
    id: orderId, createdAt: nowText, customerId: customerId, name: input.name, phone: input.phone,
    lineUserId: user.userId, lineName: user.name, status: '待付訂金',
    total: calc.total, deposit: calc.deposit, depositPaid: 0, balance: calc.balanceBeforeShipping, balancePaid: 0,
    shippingFee: 0, refund: 0, pickup: input.pickup, storeName: input.storeName, storeId: input.storeId,
    address: input.address, deadline: deadlines[0] || '', buyBatch: batches.join('、'), shipBatch: '', trackingNo: '',
    depositLast5: '', balanceLast5: '', itemsSummary: MuvellaLogic.summarizeItems(calc.lines),
    customerNote: input.note, adminNote: '', source: 'LIFF', updatedAt: nowText
  };
  dbAppend_('訂單', order);
  var itemRows = calc.lines.map(function (l) {
    var row = {
      orderId: orderId, productId: l.productId, name: l.name, variant: l.variant, qty: l.qty, unitPrice: l.unitPrice,
      subtotal: l.subtotal, depositRatio: l.depositRatio, deposit: l.deposit, deadline: l.deadline, buyBatch: l.buyBatch, lineStatus: '正常'
    };
    dbAppend_('訂單明細', row);
    return row;
  });
  dbAppend_('狀態紀錄', { time: nowText, orderId: orderId, from: '', to: '待付訂金', by: '顧客', note: '顧客從 LINE 下單' });

  return {
    order: customerOrderView_(order, itemRows, [{ to: '待付訂金', time: nowText }]),
    bank: MuvellaLogic.bankInfo(settings),
    settings: MuvellaLogic.publicSettings(settings)
  };
}

function myOrders_(userId) {
  return dbAll_('訂單').filter(function (o) { return !!userId && o.lineUserId === userId; });
}

function getMyOrders(user, payload) {
  var settings = getSettings_();
  var orders = myOrders_(user.userId).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  var items = dbAll_('訂單明細');
  var hist = dbAll_('狀態紀錄');
  return {
    orders: orders.map(function (o) {
      return customerOrderView_(o,
        items.filter(function (it) { return it.orderId === o.id; }),
        hist.filter(function (h) { return h.orderId === o.id; }));
    }),
    bank: MuvellaLogic.bankInfo(settings),
    settings: MuvellaLogic.publicSettings(settings)
  };
}

function myOrder_(user, orderId) {
  var id = MuvellaLogic.cleanText(orderId);
  var o = dbFind_('訂單', 'id', id);
  // 找不到或不是本人的訂單，回同一個訊息，不透露訂單是否存在
  if (!o || o.lineUserId !== user.userId) throw appError_('NOT_FOUND', '找不到這筆訂單');
  return o;
}

function reportPayment(user, payload) {
  var o = myOrder_(user, payload.orderId);
  var kind = payload.kind;
  var last5 = String(payload.last5 === undefined ? '' : payload.last5).trim();
  if (!MuvellaLogic.validateLast5(last5)) throw appError_('INVALID', '帳號後五碼要是 5 位數字');
  var amount = '';
  if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
    amount = MuvellaLogic.toNumber(payload.amount, NaN);
    if (!(amount > 0 && Math.floor(amount) === amount && amount <= 10000000)) throw appError_('INVALID', '轉帳金額要是正整數');
  }
  var paidAt = MuvellaLogic.cleanText(payload.time).replace('T', ' ').slice(0, 16);
  if (paidAt && !/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(paidAt)) throw appError_('INVALID', '轉帳時間格式不正確');

  var action, field, to;
  if (kind === '訂金') { action = 'reportDeposit'; field = 'depositLast5'; }
  else if (kind === '尾款') { action = 'reportBalance'; field = 'balanceLast5'; }
  else throw appError_('INVALID', '款項類別不正確');
  if (!MuvellaLogic.customerCan(action, o.status)) throw appError_('BAD_STATE', '這筆訂單目前不需要回報' + kind);
  to = MuvellaLogic.CUSTOMER_ACTIONS[action].to;

  var nowText = nowText_();
  var patch = {};
  patch[field] = last5;
  if (o.status !== to) {
    changeStatus_(o, to, '顧客', '顧客回報' + kind + '後五碼 ' + last5, patch);
  } else {
    patch.updatedAt = nowText;
    dbUpdateRow_('訂單', o._row, patch);
  }
  dbAppend_('匯款對帳', {
    id: MuvellaLogic.formatPaymentId(dbNextCounter_('對帳')), orderId: o.id, kind: kind, paidAt: paidAt, amount: amount,
    last5: last5, result: '待查', createdAt: nowText, by: '顧客', source: '顧客回報', note: ''
  });
  dbReset_();
  var fresh = dbFind_('訂單', 'id', o.id);
  return { order: customerOrderView_(fresh, orderItems_(o.id), orderHistory_(o.id)) };
}

function cancelMyOrder(user, payload) {
  var o = myOrder_(user, payload.orderId);
  if (!MuvellaLogic.customerCan('cancel', o.status)) throw appError_('BAD_STATE', '這筆訂單已經在處理中，要取消請在聊天室聯絡店家');
  changeStatus_(o, '已取消', '顧客', '顧客自行取消');
  dbReset_();
  var fresh = dbFind_('訂單', 'id', o.id);
  return { order: customerOrderView_(fresh, orderItems_(o.id), orderHistory_(o.id)) };
}
/**
 * Admin.gs｜後台動作
 *
 * 每個動作第一行都呼叫 requireAdmin(user)（router 也會先檢查一次）。
 * 後台網頁隱藏按鈕只是方便，真正的權限在這裡。
 * v1 沒有任何 LINE 推播程式；adminDraft 只產生文字給店家自己複製貼上。
 */

function adminOrderView_(o, items) {
  var out = stripRow_(o);
  delete out.lineUserId; // 後台畫面也不需要顯示 LINE 使用者 ID
  out.hasLineId = !!o.lineUserId;
  out.balance = MuvellaLogic.computeBalance(o);
  out.balanceOutstanding = MuvellaLogic.balanceOutstanding(o);
  out.items = items || [];
  out.nextStatuses = MuvellaLogic.nextStatuses(o.status);
  return out;
}

function itemsByOrder_() {
  var map = {};
  dbAll_('訂單明細').forEach(function (it) { (map[it.orderId] = map[it.orderId] || []).push(stripRow_(it)); });
  return map;
}

function mustOrder_(orderId) {
  var o = dbFind_('訂單', 'id', MuvellaLogic.cleanText(orderId));
  if (!o) throw appError_('NOT_FOUND', '找不到訂單 ' + orderId);
  return o;
}

function recentPayments_(limit) {
  return dbAll_('匯款對帳').map(stripRow_).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).slice(0, limit || 50);
}

// ───────── 總覽 ─────────

function adminDashboard(user, payload) {
  requireAdmin(user);
  var now = new Date();
  var orders = dbAll_('訂單');
  var stats = MuvellaLogic.dashboardStats(orders, dbAll_('商品'), now);
  var byOrder = itemsByOrder_();
  var todo = orders.filter(function (o) {
    return ['新訂單', '待付訂金', '訂金待對帳', '抵台待付尾款', '尾款待對帳', '異常'].indexOf(o.status) >= 0;
  }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).slice(0, 30)
    .map(function (o) { return adminOrderView_(o, byOrder[o.id]); });
  return { me: { name: user.name }, stats: stats, todo: todo, now: MuvellaLogic.formatTaipeiDateTime(now), settings: MuvellaLogic.publicSettings(getSettings_()) };
}

// ───────── 商品 ─────────

function adminListProducts(user, payload) {
  requireAdmin(user);
  var settings = getSettings_();
  return { products: dbAll_('商品').map(stripRow_), defaultDepositRatio: settings.depositRatio, today: MuvellaLogic.formatTaipeiDate(new Date()) };
}

function adminSaveProduct(user, payload) {
  requireAdmin(user);
  var check = MuvellaLogic.validateProductInput(payload);
  if (!check.ok) throw validationError_(check.errors);
  var v = check.value;
  delete v.variantGroups; // 規格已存成文字（一組一行）
  var nowText = nowText_();
  v.updatedAt = nowText;
  var id = MuvellaLogic.cleanText(payload.id);
  if (id) {
    var p = dbFind_('商品', 'id', id);
    if (!p) throw appError_('NOT_FOUND', '找不到商品 ' + id);
    dbUpdateRow_('商品', p._row, v);
    v.id = id;
  } else {
    v.id = MuvellaLogic.formatProductId(dbNextCounter_('商品'));
    v.createdAt = nowText;
    dbAppend_('商品', v);
  }
  dbReset_();
  return { product: stripRow_(dbFind_('商品', 'id', v.id)) };
}

// ───────── 訂單 ─────────

function adminListOrders(user, payload) {
  requireAdmin(user);
  var byOrder = itemsByOrder_();
  var orders = dbAll_('訂單').slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
    .map(function (o) { return adminOrderView_(o, byOrder[o.id]); });
  return {
    orders: orders,
    payments: recentPayments_(50),
    products: dbAll_('商品').map(function (p) { return { id: p.id, name: p.name }; }),
    shipBatches: dbAll_('回台批次').map(function (b) { return b.id; })
  };
}

function adminGetOrder(user, payload) {
  requireAdmin(user);
  var o = mustOrder_(payload.orderId);
  return {
    order: adminOrderView_(o, orderItems_(o.id)),
    history: orderHistory_(o.id),
    payments: dbAll_('匯款對帳').filter(function (p) { return p.orderId === o.id; }).map(stripRow_),
    delivery: stripRow_(dbFind_('台灣配送', 'orderId', o.id) || {}),
    templates: Object.keys(MuvellaLogic.DRAFT_TEMPLATES),
    suggestedTemplate: MuvellaLogic.suggestTemplate(o.status)
  };
}

/** 狀態變更後的連帶更新（台灣配送、明細狀態） */
function statusSideEffects_(order, to) {
  var today = MuvellaLogic.formatTaipeiDate(new Date());
  var d = dbFind_('台灣配送', 'orderId', order.id);
  if (to === '已出貨／待取貨' && d) dbUpdateRow_('台灣配送', d._row, { status: '已出貨', sentDate: d.sentDate || today, updatedAt: nowText_() });
  if (to === '已完成' && d) dbUpdateRow_('台灣配送', d._row, { status: '已取', doneDate: d.doneDate || today, updatedAt: nowText_() });
}

function adminUpdateOrderStatus(user, payload) {
  requireAdmin(user);
  var to = payload.to;
  if (!MuvellaLogic.isStatus(to)) throw appError_('INVALID', '狀態不正確');
  var note = MuvellaLogic.cleanText(payload.note, true).slice(0, 200);
  var ids = Array.isArray(payload.orderIds) ? payload.orderIds.slice(0, 500) : [payload.orderId];
  var updated = [], skipped = [];
  ids.forEach(function (id) {
    var o = dbFind_('訂單', 'id', MuvellaLogic.cleanText(id));
    if (!o) { skipped.push({ orderId: id, reason: '找不到訂單' }); return; }
    if (!MuvellaLogic.canTransition(o.status, to)) { skipped.push({ orderId: o.id, reason: '「' + o.status + '」不能直接改成「' + to + '」' }); return; }
    changeStatus_(o, to, adminLabel_(user), note);
    statusSideEffects_(o, to);
    dbReset_();
    updated.push(o.id);
  });
  if (!Array.isArray(payload.orderIds) && skipped.length) throw appError_('BAD_TRANSITION', skipped[0].reason);
  return { updated: updated, skipped: skipped };
}

function adminRecordPayment(user, payload) {
  requireAdmin(user);
  var last5 = String(payload.last5 || '').trim();
  if (!MuvellaLogic.validateLast5(last5)) throw appError_('INVALID', '帳號後五碼要是 5 位數字');
  var orderId = MuvellaLogic.cleanText(payload.orderId);
  var order = orderId ? mustOrder_(orderId) : null;
  var eff = MuvellaLogic.paymentEffect(order, { kind: payload.kind, amount: MuvellaLogic.toNumber(payload.amount, NaN), result: payload.result });
  if (!eff.ok) throw appError_('INVALID', eff.error);
  var paidAt = MuvellaLogic.cleanText(payload.paidAt).replace('T', ' ').slice(0, 16);
  var nowText = nowText_();
  var note = MuvellaLogic.cleanText(payload.note, true).slice(0, 200);
  var pay = {
    id: MuvellaLogic.formatPaymentId(dbNextCounter_('對帳')), orderId: order ? order.id : '', kind: payload.kind, paidAt: paidAt,
    amount: MuvellaLogic.toNumber(payload.amount, ''), last5: last5, result: payload.result, createdAt: nowText,
    by: adminLabel_(user), source: '店家登錄', note: note
  };
  dbAppend_('匯款對帳', pay);
  if (order) {
    var patch = eff.fields;
    if (payload.kind === '訂金' && !order.depositLast5) patch.depositLast5 = last5;
    if (payload.kind === '尾款' && !order.balanceLast5) patch.balanceLast5 = last5;
    if (eff.toStatus && eff.toStatus !== order.status) {
      var merged = {}; Object.keys(order).forEach(function (k) { merged[k] = order[k]; });
      Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
      patch.balance = MuvellaLogic.computeBalance(merged);
      changeStatus_(order, eff.toStatus, adminLabel_(user), pay.kind + ' ' + pay.amount + ' 元・後五碼 ' + last5 + '・' + pay.result, patch);
    } else if (Object.keys(patch).length) {
      patch.updatedAt = nowText;
      dbUpdateRow_('訂單', order._row, patch);
    }
  }
  dbReset_();
  return { payment: pay, order: order ? adminOrderView_(dbFind_('訂單', 'id', order.id), orderItems_(order.id)) : null };
}

function adminSetShipping(user, payload) {
  requireAdmin(user);
  var o = mustOrder_(payload.orderId);
  var patch = {};
  function money(v, label) {
    var n = MuvellaLogic.toNumber(v, NaN);
    if (!(n >= 0 && Math.floor(n) === n && n <= 1000000)) throw appError_('INVALID', label + '要是 0 以上的整數');
    return n;
  }
  if (payload.shippingFee !== undefined && payload.shippingFee !== '') patch.shippingFee = money(payload.shippingFee, '運費');
  if (payload.refund !== undefined && payload.refund !== '') patch.refund = money(payload.refund, '退款金額');
  if (payload.trackingNo !== undefined) {
    patch.trackingNo = MuvellaLogic.cleanText(payload.trackingNo);
    if (patch.trackingNo.length > 40) throw appError_('INVALID', '物流單號太長');
  }
  if (payload.shipBatch !== undefined) {
    var sb = MuvellaLogic.cleanText(payload.shipBatch);
    if (sb && !dbFind_('回台批次', 'id', sb)) throw appError_('NOT_FOUND', '找不到回台批次 ' + sb);
    patch.shipBatch = sb;
  }
  var merged = {}; Object.keys(o).forEach(function (k) { merged[k] = o[k]; });
  Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
  patch.balance = MuvellaLogic.computeBalance(merged);
  patch.updatedAt = nowText_();
  dbUpdateRow_('訂單', o._row, patch);

  // 台灣配送紀錄
  var d = dbFind_('台灣配送', 'orderId', o.id);
  var method = MuvellaLogic.cleanText(payload.deliveryMethod);
  var dPatch = { updatedAt: patch.updatedAt };
  if (patch.trackingNo !== undefined) dPatch.trackingNo = patch.trackingNo;
  if (patch.shippingFee !== undefined) dPatch.fee = patch.shippingFee;
  if (method) dPatch.method = method.slice(0, 20);
  if (d) dbUpdateRow_('台灣配送', d._row, dPatch);
  else if (patch.trackingNo || method) {
    dPatch.orderId = o.id; dPatch.shipBatch = merged.shipBatch || ''; dPatch.status = '待出貨';
    dPatch.method = dPatch.method || (o.pickup === '7-11' ? '交貨便' : '宅配');
    dbAppend_('台灣配送', dPatch);
  }
  dbReset_();
  return { order: adminOrderView_(dbFind_('訂單', 'id', o.id), orderItems_(o.id)) };
}

function adminSetNote(user, payload) {
  requireAdmin(user);
  var o = mustOrder_(payload.orderId);
  var note = MuvellaLogic.cleanText(payload.note, true);
  if (note.length > 500) throw appError_('INVALID', '店家備註最多 500 字');
  dbUpdateRow_('訂單', o._row, { adminNote: note, updatedAt: nowText_() });
  return { orderId: o.id, adminNote: note };
}

// ───────── 採購 ─────────

function adminPurchaseList(user, payload) {
  requireAdmin(user);
  var orders = dbAll_('訂單');
  var agg = MuvellaLogic.aggregatePurchase(orders, dbAll_('訂單明細'));
  var records = dbAll_('採購明細');
  var infos = dbAll_('採購批次');
  var byId = {}; orders.forEach(function (o) { byId[o.id] = o; });
  return {
    batches: agg.map(function (b) {
      var info = stripRow_(infos.filter(function (x) { return x.id === b.batch; })[0] || { id: b.batch, status: '準備中' });
      return {
        batch: b.batch, deadlines: b.deadlines, info: info,
        lines: b.lines.map(function (l) {
          var r = records.filter(function (x) { return x.batch === b.batch && x.productId === l.productId && x.variant === l.variant; })[0];
          return { productId: l.productId, variant: l.variant, name: l.name, needQty: l.qty, orderIds: l.orderIds, record: r ? stripRow_(r) : null };
        }),
        orders: b.orderIds.map(function (id) { var o = byId[id]; return { id: o.id, name: o.name, status: o.status, itemsSummary: o.itemsSummary }; })
      };
    })
  };
}

function adminSavePurchaseRecord(user, payload) {
  requireAdmin(user);
  var batch = MuvellaLogic.cleanText(payload.batch);
  if (!/^BUY-\d{8}$/.test(batch)) throw appError_('INVALID', '採購批次編號不正確');
  var nowText = nowText_();
  if (payload.batchInfo) {
    var bi = payload.batchInfo;
    var st = MuvellaLogic.cleanText(bi.status) || '準備中';
    if (MuvellaLogic.BUY_BATCH_STATUSES.indexOf(st) < 0) throw appError_('INVALID', '批次狀態不正確');
    var rec = {
      deadlines: MuvellaLogic.cleanText(bi.deadlines).slice(0, 100), plannedDate: MuvellaLogic.cleanText(bi.plannedDate).slice(0, 20),
      actualDate: MuvellaLogic.cleanText(bi.actualDate).slice(0, 30), place: MuvellaLogic.cleanText(bi.place).slice(0, 60),
      status: st, note: MuvellaLogic.cleanText(bi.note, true).slice(0, 300), updatedAt: nowText
    };
    var ex = dbFind_('採購批次', 'id', batch);
    if (ex) dbUpdateRow_('採購批次', ex._row, rec);
    else { rec.id = batch; dbAppend_('採購批次', rec); }
    return { saved: 'batch' };
  }
  var pid = MuvellaLogic.cleanText(payload.productId);
  var variant = MuvellaLogic.cleanText(payload.variant);
  function optInt(v, label) {
    if (v === '' || v === undefined || v === null) return '';
    var n = MuvellaLogic.toNumber(v, NaN);
    if (!(n >= 0 && Math.floor(n) === n && n <= 100000)) throw appError_('INVALID', label + '要是 0 以上的整數');
    return n;
  }
  var line = {
    batch: batch, productId: pid, variant: variant, name: MuvellaLogic.cleanText(payload.name).slice(0, 60),
    needQty: MuvellaLogic.toNumber(payload.needQty, 0), boughtQty: optInt(payload.boughtQty, '實買數量'),
    actualPrice: MuvellaLogic.cleanText(payload.actualPrice).slice(0, 40), outQty: optInt(payload.outQty, '缺貨數量'),
    note: MuvellaLogic.cleanText(payload.note, true).slice(0, 300), updatedAt: nowText
  };
  var existing = dbAll_('採購明細').filter(function (x) { return x.batch === batch && x.productId === pid && x.variant === variant; })[0];
  if (existing) dbUpdateRow_('採購明細', existing._row, line);
  else dbAppend_('採購明細', line);
  return { saved: 'line', line: line };
}

// ───────── 回台批次與台灣配送 ─────────

function adminListShipBatches(user, payload) {
  requireAdmin(user);
  var orders = dbAll_('訂單');
  var deliveries = dbAll_('台灣配送').map(stripRow_);
  var batches = dbAll_('回台批次').map(stripRow_).sort(function (a, b) { return a.id < b.id ? 1 : -1; });
  function brief(o) {
    return { id: o.id, name: o.name, status: o.status, pickup: o.pickup, itemsSummary: o.itemsSummary, shipBatch: o.shipBatch, trackingNo: o.trackingNo, shippingFee: o.shippingFee, balanceOutstanding: MuvellaLogic.balanceOutstanding(o) };
  }
  return {
    batches: batches.map(function (b) {
      var list = orders.filter(function (o) { return o.shipBatch === b.id; }).map(brief);
      b.orders = list;
      b.count = list.length;
      return b;
    }),
    eligible: orders.filter(function (o) { return o.status === '已採購' && !o.shipBatch; }).map(brief),
    taiwan: orders.filter(function (o) { return ['抵台待付尾款', '尾款待對帳', '已付尾款', '已出貨／待取貨'].indexOf(o.status) >= 0; }).map(function (o) {
      var b = brief(o);
      b.delivery = deliveries.filter(function (d) { return d.orderId === o.id; })[0] || null;
      return b;
    })
  };
}

function adminSaveShipBatch(user, payload) {
  requireAdmin(user);
  var depart = MuvellaLogic.cleanText(payload.departDate);
  var arrive = MuvellaLogic.cleanText(payload.arriveDate);
  if (depart && !MuvellaLogic.parseYmd(depart)) throw appError_('INVALID', '出發日格式要是 YYYY-MM-DD');
  if (!MuvellaLogic.parseYmd(arrive)) throw appError_('INVALID', '請填預計抵達台灣日（YYYY-MM-DD）');
  var status = MuvellaLogic.cleanText(payload.status) || '尚未出發';
  if (MuvellaLogic.SHIP_BATCH_STATUSES.indexOf(status) < 0) throw appError_('INVALID', '批次狀態不正確');
  var note = MuvellaLogic.cleanText(payload.note, true);
  if (note.length > 200) throw appError_('INVALID', '併運備註最多 200 字');
  var rec = { departDate: depart, arriveDate: arrive, note: note, status: status, updatedAt: nowText_() };
  var id = MuvellaLogic.cleanText(payload.id);
  if (id) {
    var ex = dbFind_('回台批次', 'id', id);
    if (!ex) throw appError_('NOT_FOUND', '找不到回台批次 ' + id);
    dbUpdateRow_('回台批次', ex._row, rec);
  } else {
    id = MuvellaLogic.formatShipBatch(arrive);
    if (dbFind_('回台批次', 'id', id)) throw appError_('DUPLICATE', id + ' 已經存在，請直接編輯那一批');
    rec.id = id; rec.count = 0;
    dbAppend_('回台批次', rec);
  }
  dbReset_();
  return { batch: stripRow_(dbFind_('回台批次', 'id', id)) };
}

function adminAssignShipBatch(user, payload) {
  requireAdmin(user);
  var b = dbFind_('回台批次', 'id', MuvellaLogic.cleanText(payload.batchId));
  if (!b) throw appError_('NOT_FOUND', '找不到回台批次');
  if (b.status === '已抵達') throw appError_('BAD_STATE', '這一批已經抵達，不能再加入訂單');
  var ids = Array.isArray(payload.orderIds) ? payload.orderIds.slice(0, 500) : [];
  var updated = [], skipped = [];
  ids.forEach(function (id) {
    var o = dbFind_('訂單', 'id', MuvellaLogic.cleanText(id));
    if (!o) { skipped.push({ orderId: id, reason: '找不到訂單' }); return; }
    if (o.status === '已採購') {
      changeStatus_(o, '回台運送中', adminLabel_(user), '加入回台批次 ' + b.id, { shipBatch: b.id });
    } else if (o.status === '回台運送中') {
      dbUpdateRow_('訂單', o._row, { shipBatch: b.id, updatedAt: nowText_() });
    } else { skipped.push({ orderId: o.id, reason: '狀態是「' + o.status + '」，要先標為已採購' }); return; }
    dbReset_();
    updated.push(o.id);
  });
  var count = dbAll_('訂單').filter(function (o) { return o.shipBatch === b.id; }).length;
  var bb = dbFind_('回台批次', 'id', b.id);
  dbUpdateRow_('回台批次', bb._row, { count: count, status: bb.status === '尚未出發' && updated.length ? '運送中' : bb.status, updatedAt: nowText_() });
  return { updated: updated, skipped: skipped };
}

function adminMarkShipArrived(user, payload) {
  requireAdmin(user);
  var b = dbFind_('回台批次', 'id', MuvellaLogic.cleanText(payload.batchId));
  if (!b) throw appError_('NOT_FOUND', '找不到回台批次');
  var date = MuvellaLogic.cleanText(payload.arrivedDate) || MuvellaLogic.formatTaipeiDate(new Date());
  if (!MuvellaLogic.parseYmd(date)) throw appError_('INVALID', '抵達日格式要是 YYYY-MM-DD');
  var updated = [];
  dbAll_('訂單').filter(function (o) { return o.shipBatch === b.id && o.status === '回台運送中'; }).forEach(function (o) {
    var fresh = dbFind_('訂單', 'id', o.id);
    changeStatus_(fresh, '抵台待付尾款', adminLabel_(user), b.id + ' 已抵台');
    if (!dbFind_('台灣配送', 'orderId', o.id)) {
      dbAppend_('台灣配送', { orderId: o.id, shipBatch: b.id, method: o.pickup === '7-11' ? '交貨便' : '宅配', trackingNo: '', sentDate: '', doneDate: '', fee: '', status: '待出貨', updatedAt: nowText_() });
    }
    dbReset_();
    updated.push(o.id);
  });
  var bb = dbFind_('回台批次', 'id', b.id);
  dbUpdateRow_('回台批次', bb._row, { status: '已抵達', arriveDate: date, updatedAt: nowText_() });
  return { updated: updated };
}

// ───────── 顧客 ─────────

function adminListCustomers(user, payload) {
  requireAdmin(user);
  var orders = dbAll_('訂單');
  return {
    customers: dbAll_('顧客').map(function (c) {
      var mine = orders.filter(function (o) { return o.customerId === c.id; });
      return {
        id: c.id, name: c.name, phone: c.phone, lineName: c.lineName, pickup: c.pickup, createdAt: c.createdAt,
        lastOrderAt: c.lastOrderAt, doNotContact: c.doNotContact, dataStatus: c.dataStatus || '正常', note: c.note,
        orderCount: mine.length,
        activeCount: mine.filter(function (o) { return !MuvellaLogic.isFinal(o.status); }).length,
        orderIds: mine.map(function (o) { return o.id; })
      };
    })
  };
}

function adminUpdateCustomer(user, payload) {
  requireAdmin(user);
  var c = dbFind_('顧客', 'id', MuvellaLogic.cleanText(payload.customerId));
  if (!c) throw appError_('NOT_FOUND', '找不到顧客');
  var patch = {};
  if (payload.doNotContact !== undefined) patch.doNotContact = payload.doNotContact === true;
  if (payload.note !== undefined) {
    patch.note = MuvellaLogic.cleanText(payload.note, true);
    if (patch.note.length > 200) throw appError_('INVALID', '備註最多 200 字');
  }
  dbUpdateRow_('顧客', c._row, patch);
  return { customerId: c.id };
}

/** 顧客要求刪除個資：清空聯絡欄位，訂單只留編號、金額與狀態供對帳 */
function adminAnonymizeCustomer(user, payload) {
  requireAdmin(user);
  var c = dbFind_('顧客', 'id', MuvellaLogic.cleanText(payload.customerId));
  if (!c) throw appError_('NOT_FOUND', '找不到顧客');
  var orders = dbAll_('訂單').filter(function (o) { return o.customerId === c.id; });
  var active = orders.filter(function (o) { return !MuvellaLogic.isFinal(o.status); });
  if (active.length && payload.force !== true) {
    throw appError_('HAS_ACTIVE', '這位顧客還有 ' + active.length + ' 筆進行中的訂單，請先處理完或確認後再刪除');
  }
  var nowText = nowText_();
  dbUpdateRow_('顧客', c._row, {
    name: '（已刪除）', phone: '', lineUserId: '', lineName: '', storeName: '', storeId: '', address: '',
    note: '已依本人要求刪除個資 ' + nowText, dataStatus: '已刪除', doNotContact: true
  });
  orders.forEach(function (o) {
    var fresh = dbFind_('訂單', 'id', o.id);
    dbUpdateRow_('訂單', fresh._row, { name: '（已刪除）', phone: '', lineUserId: '', lineName: '', storeName: '', storeId: '', address: '', customerNote: '', updatedAt: nowText });
    dbReset_();
  });
  return { customerId: c.id, orders: orders.length };
}

// ───────── 設定與通知稿 ─────────

function adminGetSettings(user, payload) {
  requireAdmin(user);
  var s = getSettings_();
  var out = {};
  SETTINGS_ROWS.forEach(function (r) { out[r[1]] = s[r[1]]; });
  return { settings: out };
}

function adminSaveSettings(user, payload) {
  requireAdmin(user);
  var check = MuvellaLogic.validateSettingsInput(payload);
  if (!check.ok) throw validationError_(check.errors);
  saveSettings_(check.value);
  dbReset_();
  return adminGetSettings(user, {});
}

function adminDraft(user, payload) {
  requireAdmin(user);
  var o = mustOrder_(payload.orderId);
  var key = MuvellaLogic.cleanText(payload.templateKey) || MuvellaLogic.suggestTemplate(o.status);
  var order = stripRow_(o);
  order.items = orderItems_(o.id);
  var r = MuvellaLogic.buildNotificationDraft(key, order, getSettings_());
  if (!r.ok) throw appError_('INVALID', r.error);
  return { text: r.text, templateKey: key, bankMissing: r.bankMissing, doNotContact: !!(dbFind_('顧客', 'id', o.customerId) || {}).doNotContact };
}

return {reset(){localStorage.removeItem(KEY);location.reload();},async handle(action,payload={}){try{db=JSON.parse(localStorage.getItem(KEY)||'null')||seed();const route=routes_()[action];if(!route)throw appError_('UNKNOWN_ACTION','不支援的操作');const result=route.fn({userId:'U_mock_customer',name:'範例小帆'},clone(payload))||{};localStorage.setItem(KEY,JSON.stringify(db));return clone({ok:true,...result});}catch(e){return clone({ok:false,error:e.appMessage||'範例資料處理失敗',code:e.appCode||'SERVER',errors:e.appErrors||[]});}}};
})();
