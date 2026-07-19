/*************************************************************
 * 寮費・食費清算管理システム — GAS バックエンド (Web Apps API)
 * -----------------------------------------------------------
 * Google スプレッドシートを DB として使用し、フロントエンド
 * (Vercel) からの CORS リクエストを処理する API サーバーです。
 *
 * 【デプロイ手順】
 *  1. スプレッドシートを新規作成し「拡張機能 > Apps Script」を開く
 *  2. 本ファイルの内容を Code.gs に貼り付けて保存
 *  3. 一度 `setupSheets` を実行して各シートを自動生成（初回のみ）
 *  4. 「デプロイ > 新しいデプロイ > 種類:ウェブアプリ」
 *       - 次のユーザーとして実行: 自分
 *       - アクセスできるユーザー: 全員
 *  5. 発行された /exec で終わる URL をフロントの
 *     VITE_GAS_API_URL に設定
 *
 * 【CORS について】
 *  ContentService(JSON) を返すシンプルな GET/POST は
 *  ブラウザのプリフライトが発生しません。フロント側は
 *  Content-Type: text/plain で POST し、ここで JSON.parse します。
 *************************************************************/

// ---- シート名・スキーマ定義 ---------------------------------
var SHEETS = {
  members: {
    name: 'members',
    // grade / dorm は既存データの列位置を崩さないよう末尾に追加
    headers: ['id', 'name', 'rank', 'group', 'active', 'grade', 'dorm'],
  },
  meal_logs: {
    name: 'meal_logs',
    // dorm（1寮/2寮）は既存データの列位置を崩さないよう末尾に追加
    headers: ['date', 'member_id', 'breakfast', 'dinner', 'dorm'],
  },
  guest_meals: {
    name: 'guest_meals',
    headers: ['date', 'school', 'name', 'breakfast', 'dinner', 'dorm'],
  },
  monthly_expenses: {
    name: 'monthly_expenses',
    headers: [
      'year_month',
      'member_id',
      'tournament_fee',
      'tournament_support_rate',
      'camp_fee_per_night',
      'camp_nights',
      'medical_actual',
      'medical_subsidy',
      'sagawa_fee',
      'wear_fee',
    ],
  },
  tournament_items: {
    name: 'tournament_items',
    headers: ['year_month', 'member_id', 'name', 'fee', 'subsidy'],
  },
  camp_items: {
    name: 'camp_items',
    headers: ['year_month', 'member_id', 'name', 'fee_per_night', 'nights'],
  },
  other_items: {
    // 佐川代・ウエア代と同じイメージで、自由に名前を付けて追加できる費用項目
    name: 'other_items',
    headers: ['year_month', 'member_id', 'name', 'amount'],
  },
  config: {
    name: 'config',
    headers: ['key', 'value'],
  },
};

var DEFAULT_CONFIG = [
  ['breakfast_price', 400],
  ['dinner_price', 600],
  ['base_club_fee', 3000],
];

// ---- スプレッドシートID（任意） -----------------------------
// 通常はスプレッドシートに紐付いたスクリプト（拡張機能 > Apps Script
// から開いたもの）なら空のままで動作します。
// 単独プロジェクト等で getActiveSpreadsheet() が null になる場合は、
// 対象スプレッドシートのURL
//   https://docs.google.com/spreadsheets/d/【この部分がID】/edit
// をここに貼り付けてください。
var SPREADSHEET_ID = '';

// =============================================================
// エントリポイント
// =============================================================
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    var params = {};
    // POST body (text/plain JSON) を優先的に解析
    if (method === 'POST' && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents) || {};
      } catch (err) {
        params = {};
      }
    }
    // クエリパラメータをマージ
    if (e.parameter) {
      for (var k in e.parameter) {
        if (params[k] === undefined) params[k] = e.parameter[k];
      }
    }

    var action = params.action;
    var data;

    switch (action) {
      case 'getInitialData':
        data = getInitialData(params.year_month);
        break;
      case 'saveMembers':
        data = saveMembers(params.members);
        break;
      case 'saveMealLogs':
        data = saveMealLogs(
          params.year_month,
          params.logs,
          params.guests,
          params.date,
          params.dorm
        );
        break;
      case 'saveExpenses':
        data = saveExpenses(
          params.year_month,
          params.expenses,
          params.tournamentItems,
          params.campItems,
          params.otherItems
        );
        break;
      case 'ping':
        data = { ok: true, time: new Date().toISOString() };
        break;
      default:
        return jsonOutput({ status: 'error', message: '未知のaction: ' + action });
    }

    return jsonOutput({ status: 'ok', data: data });
  } catch (err) {
    return jsonOutput({ status: 'error', message: String(err) });
  }
}

// JSON レスポンス（CORS 安全なシンプルレスポンス）
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// =============================================================
// API 実装
// =============================================================

// 初期データ一括取得
function getInitialData(yearMonth) {
  ensureSheets_();
  var members = readMembers_();
  var config = readConfig_();
  var mealLogs = readMealLogs_(yearMonth);
  var guestMeals = readGuestMeals_(yearMonth);
  var expenses = readExpenses_(yearMonth);
  var tournamentItems = readTournamentItems_(yearMonth);
  var campItems = readCampItems_(yearMonth);
  var otherItems = readOtherItems_(yearMonth);
  return {
    members: members,
    config: config,
    mealLogs: mealLogs,
    guestMeals: guestMeals,
    expenses: expenses,
    tournamentItems: tournamentItems,
    campItems: campItems,
    otherItems: otherItems,
  };
}

// メンバーマスタ全置換保存
function saveMembers(members) {
  ensureSheets_();
  members = members || [];
  var sheet = getSheet_(SHEETS.members.name);
  clearBody_(sheet);
  if (members.length) {
    var rows = members.map(function (m) {
      return [
        Number(m.id),
        String(m.name || ''),
        String(m.rank || ''),
        String(m.group || ''),
        toBool_(m.active),
        String(m.grade || ''),
        String(m.dorm || ''),
      ];
    });
    // ループ内 setValue を避け setValues で一括書き込み
    sheet.getRange(2, 1, rows.length, SHEETS.members.headers.length).setValues(rows);
  }
  return { saved: members.length };
}

// 食数ログ UPSERT（key: date + member_id + dorm）+ 見学高校生（当日×寮を総入れ替え）
function saveMealLogs(yearMonth, logs, guests, date, dorm) {
  ensureSheets_();
  logs = logs || [];
  guests = guests || [];
  dorm = String(dorm || '');
  var sheet = getSheet_(SHEETS.meal_logs.name);
  var values = getBody_(sheet); // [date, member_id, breakfast, dinner, dorm]

  // 既存を Map 化（key: date + member_id + dorm）
  var map = {};
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '' && row[1] === '') continue;
    var rdorm = String(row[4] || '');
    var key = normDate_(row[0]) + '__' + String(row[1]) + '__' + rdorm;
    map[key] = [
      normDate_(row[0]),
      Number(row[1]),
      toBool_(row[2]),
      toBool_(row[3]),
      rdorm,
    ];
  }

  // UPSERT（朝夕どちらも false の行は削除）
  for (var j = 0; j < logs.length; j++) {
    var l = logs[j];
    var ldorm = String(l.dorm || dorm);
    var k = normDate_(l.date) + '__' + String(l.member_id) + '__' + ldorm;
    var bf = toBool_(l.breakfast);
    var dn = toBool_(l.dinner);
    if (bf || dn) {
      map[k] = [normDate_(l.date), Number(l.member_id), bf, dn, ldorm];
    } else {
      delete map[k];
    }
  }

  // 一括書き戻し
  var out = [];
  for (var key2 in map) out.push(map[key2]);
  clearBody_(sheet);
  if (out.length) {
    sheet.getRange(2, 1, out.length, SHEETS.meal_logs.headers.length).setValues(out);
  }

  // 見学高校生：当日×寮の分を総入れ替え（date 指定時のみ）
  if (date) {
    saveGuestMeals_(normDate_(date), dorm, guests);
  }

  return { saved: logs.length, total: out.length, guests: guests.length };
}

// 見学高校生の食数を「指定日 × 指定寮」の分だけ入れ替える
function saveGuestMeals_(date, dorm, guests) {
  var sheet = getSheet_(SHEETS.guest_meals.name);
  var headers = SHEETS.guest_meals.headers;
  var values = getBody_(sheet);
  dorm = String(dorm || '');

  // 対象の (日付, 寮) 以外の行は温存
  var kept = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '' && row[2] === '' && row[1] === '') continue;
    var rdorm = String(row[5] || '');
    if (normDate_(row[0]) === date && rdorm === dorm) continue; // 当日×当寮は破棄
    kept.push([
      normDate_(row[0]),
      String(row[1]),
      String(row[2]),
      toBool_(row[3]),
      toBool_(row[4]),
      rdorm,
    ]);
  }

  // 学校名または氏名のいずれかがあれば追加
  var newRows = [];
  for (var g = 0; g < guests.length; g++) {
    var school = String(guests[g].school || '').trim();
    var name = String(guests[g].name || '').trim();
    if (school === '' && name === '') continue;
    newRows.push([
      date,
      school,
      name,
      toBool_(guests[g].breakfast),
      toBool_(guests[g].dinner),
      dorm,
    ]);
  }

  var outAll = kept.concat(newRows);
  clearBody_(sheet);
  if (outAll.length) {
    sheet.getRange(2, 1, outAll.length, headers.length).setValues(outAll);
  }
}

// 月次経費 UPSERT（key: year_month + member_id）
// 大会・合宿・その他費用の明細は「当月分を総入れ替え」で保存します。
function saveExpenses(yearMonth, expenses, tournamentItems, campItems, otherItems) {
  ensureSheets_();
  expenses = expenses || [];
  tournamentItems = tournamentItems || [];
  campItems = campItems || [];
  otherItems = otherItems || [];

  // --- monthly_expenses（治療/佐川/ウエア）を UPSERT ---
  var sheet = getSheet_(SHEETS.monthly_expenses.name);
  var headers = SHEETS.monthly_expenses.headers;
  var values = getBody_(sheet);

  var map = {};
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '' && row[1] === '') continue;
    var key = String(row[0]) + '__' + String(row[1]);
    map[key] = row.slice(0, headers.length);
  }

  for (var j = 0; j < expenses.length; j++) {
    var e = expenses[j];
    var ym = e.year_month || yearMonth;
    var k = String(ym) + '__' + String(e.member_id);
    map[k] = [
      String(ym),
      Number(e.member_id),
      num_(e.tournament_fee),
      num_(e.tournament_support_rate),
      num_(e.camp_fee_per_night),
      num_(e.camp_nights),
      num_(e.medical_actual),
      num_(e.medical_subsidy),
      num_(e.sagawa_fee),
      num_(e.wear_fee),
    ];
  }

  var out = [];
  for (var key2 in map) out.push(map[key2]);
  clearBody_(sheet);
  if (out.length) {
    sheet.getRange(2, 1, out.length, headers.length).setValues(out);
  }

  // --- 大会明細：当月分を総入れ替え ---
  replaceMonthItems_(
    SHEETS.tournament_items,
    yearMonth,
    tournamentItems.map(function (t) {
      return [
        String(t.year_month || yearMonth),
        Number(t.member_id),
        String(t.name || '大会'),
        num_(t.fee),
        num_(t.subsidy),
      ];
    })
  );

  // --- 合宿明細：当月分を総入れ替え ---
  replaceMonthItems_(
    SHEETS.camp_items,
    yearMonth,
    campItems.map(function (c) {
      return [
        String(c.year_month || yearMonth),
        Number(c.member_id),
        String(c.name || '合宿'),
        num_(c.fee_per_night),
        num_(c.nights),
      ];
    })
  );

  // --- その他費用明細：当月分を総入れ替え ---
  replaceMonthItems_(
    SHEETS.other_items,
    yearMonth,
    otherItems.map(function (o) {
      return [
        String(o.year_month || yearMonth),
        Number(o.member_id),
        String(o.name || 'その他'),
        num_(o.amount),
      ];
    })
  );

  return {
    saved: expenses.length,
    tournamentItems: tournamentItems.length,
    campItems: campItems.length,
    otherItems: otherItems.length,
  };
}

// 指定シートの「当月(year_month)分」を削除し、新しい行に置き換える
function replaceMonthItems_(sheetDef, yearMonth, newRows) {
  var sheet = getSheet_(sheetDef.name);
  var headers = sheetDef.headers;
  var values = getBody_(sheet);

  // 他月の行は温存
  var kept = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '' && row[1] === '') continue;
    if (String(row[0]) === String(yearMonth)) continue; // 当月は破棄
    kept.push(row.slice(0, headers.length));
  }

  var out = kept.concat(newRows);
  clearBody_(sheet);
  if (out.length) {
    sheet.getRange(2, 1, out.length, headers.length).setValues(out);
  }
}

// =============================================================
// 読み込み helper
// =============================================================

function readMembers_() {
  var sheet = getSheet_(SHEETS.members.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    out.push({
      id: Number(r[0]),
      name: String(r[1]),
      rank: String(r[2]),
      group: String(r[3]),
      active: toBool_(r[4]),
      grade: r[5] != null ? String(r[5]) : '',
      dorm: r[6] != null ? String(r[6]) : '',
    });
  }
  return out;
}

function readGuestMeals_(yearMonth) {
  var sheet = getSheet_(SHEETS.guest_meals.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '' && r[2] === '') continue;
    var date = normDate_(r[0]);
    if (yearMonth && date.indexOf(yearMonth) !== 0) continue;
    out.push({
      date: date,
      school: String(r[1]),
      name: String(r[2]),
      breakfast: toBool_(r[3]),
      dinner: toBool_(r[4]),
      dorm: r[5] != null ? String(r[5]) : '',
    });
  }
  return out;
}

function readConfig_() {
  var sheet = getSheet_(SHEETS.config.name);
  var values = getBody_(sheet);
  var out = {};
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '') continue;
    var v = r[1];
    var n = Number(v);
    out[String(r[0])] = isNaN(n) ? v : n;
  }
  return out;
}

function readMealLogs_(yearMonth) {
  var sheet = getSheet_(SHEETS.meal_logs.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    var date = normDate_(r[0]);
    // yearMonth 指定時はその月のみ返す
    if (yearMonth && date.indexOf(yearMonth) !== 0) continue;
    out.push({
      date: date,
      member_id: Number(r[1]),
      breakfast: toBool_(r[2]),
      dinner: toBool_(r[3]),
      dorm: r[4] != null ? String(r[4]) : '',
    });
  }
  return out;
}

function readExpenses_(yearMonth) {
  var sheet = getSheet_(SHEETS.monthly_expenses.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    if (yearMonth && String(r[0]) !== yearMonth) continue;
    out.push({
      year_month: String(r[0]),
      member_id: Number(r[1]),
      tournament_fee: num_(r[2]),
      tournament_support_rate: num_(r[3]),
      camp_fee_per_night: num_(r[4]),
      camp_nights: num_(r[5]),
      medical_actual: num_(r[6]),
      medical_subsidy: num_(r[7]),
      sagawa_fee: num_(r[8]),
      wear_fee: num_(r[9]),
    });
  }
  return out;
}

function readTournamentItems_(yearMonth) {
  var sheet = getSheet_(SHEETS.tournament_items.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    if (yearMonth && String(r[0]) !== yearMonth) continue;
    out.push({
      year_month: String(r[0]),
      member_id: Number(r[1]),
      name: String(r[2]),
      fee: num_(r[3]),
      subsidy: num_(r[4]),
    });
  }
  return out;
}

function readCampItems_(yearMonth) {
  var sheet = getSheet_(SHEETS.camp_items.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    if (yearMonth && String(r[0]) !== yearMonth) continue;
    out.push({
      year_month: String(r[0]),
      member_id: Number(r[1]),
      name: String(r[2]),
      fee_per_night: num_(r[3]),
      nights: num_(r[4]),
    });
  }
  return out;
}

function readOtherItems_(yearMonth) {
  var sheet = getSheet_(SHEETS.other_items.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    if (yearMonth && String(r[0]) !== yearMonth) continue;
    out.push({
      year_month: String(r[0]),
      member_id: Number(r[1]),
      name: String(r[2]),
      amount: num_(r[3]),
    });
  }
  return out;
}

// =============================================================
// シート管理 helper
// =============================================================

function getSS_() {
  // 紐付いたスプレッドシートを優先
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  // 単独プロジェクト等では SPREADSHEET_ID から開く
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  throw new Error(
    'スプレッドシートが取得できません。スプレッドシートの「拡張機能 > Apps Script」から' +
      '開いたスクリプトに貼り付けるか、Code.js 冒頭の SPREADSHEET_ID に対象シートのIDを設定してください。'
  );
}

function getSheet_(name) {
  var ss = getSS_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ヘッダー行以外（本文）を2次元配列で取得
function getBody_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}

// 本文をクリア（ヘッダーは残す）
function clearBody_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(1, sheet.getLastColumn());
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
}

// 全シートの存在とヘッダーを保証
function ensureSheets_() {
  for (var key in SHEETS) {
    var def = SHEETS[key];
    var sheet = getSheet_(def.name);
    var firstRow = sheet.getRange(1, 1, 1, def.headers.length).getValues()[0];
    var needHeader = false;
    for (var i = 0; i < def.headers.length; i++) {
      if (firstRow[i] !== def.headers[i]) {
        needHeader = true;
        break;
      }
    }
    if (needHeader) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.setFrozenRows(1);
    }
  }
  // config が空ならデフォルト投入
  var cfg = getSheet_(SHEETS.config.name);
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, DEFAULT_CONFIG.length, 2).setValues(DEFAULT_CONFIG);
  }
}

// =============================================================
// 手動セットアップ（初回にエディタから実行）
// =============================================================
function setupSheets() {
  var ss = getSS_();
  Logger.log('操作対象スプレッドシート: ' + ss.getName());
  Logger.log('URL: ' + ss.getUrl());
  ensureSheets_();
  var names = ss.getSheets().map(function (s) {
    return s.getName();
  });
  Logger.log('現在のシート一覧: ' + JSON.stringify(names));
  try {
    ss.toast(
      'シートを初期化しました (members / meal_logs / monthly_expenses / config)',
      'セットアップ完了',
      5
    );
  } catch (e) {
    // 単独プロジェクト等では toast が使えないため無視
  }
  return { url: ss.getUrl(), sheets: names };
}

// =============================================================
// 診断用（どのスプレッドシートに書き込むかを実行ログに出力）
// この関数を実行 → 上部メニュー「実行ログ」を確認してください。
// =============================================================
function diagnose() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(
    'getActiveSpreadsheet(): ' +
      (active ? active.getName() + ' / ' + active.getUrl() : 'null（未紐付け）')
  );
  Logger.log('SPREADSHEET_ID 定数: ' + (SPREADSHEET_ID || '(空)'));

  var ss = getSS_();
  var before = ss.getSheets().map(function (s) {
    return s.getName();
  });
  Logger.log('▼ 操作対象: ' + ss.getName());
  Logger.log('▼ 操作対象URL（ここに作られます）: ' + ss.getUrl());
  Logger.log('作成前のシート: ' + JSON.stringify(before));

  ensureSheets_();

  var after = ss.getSheets().map(function (s) {
    return s.getName();
  });
  Logger.log('作成後のシート: ' + JSON.stringify(after));
  Logger.log(
    '===> このURLを開いてシートが増えているか確認してください: ' + ss.getUrl()
  );
  return { targetUrl: ss.getUrl(), before: before, after: after };
}

// =============================================================
// 値変換 helper
// =============================================================

function toBool_(v) {
  if (v === true) return true;
  if (v === false) return false;
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES' || s === '◯' || s === 'O';
}

function num_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

// 日付を YYYY-MM-DD 文字列に正規化
function normDate_(v) {
  if (v instanceof Date) {
    var y = v.getFullYear();
    var m = ('0' + (v.getMonth() + 1)).slice(-2);
    var d = ('0' + v.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return String(v);
}
