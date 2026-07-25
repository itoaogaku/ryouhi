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
    // grade / dorm / name_kana は既存データの列位置を崩さないよう末尾に追加
    headers: ['id', 'name', 'rank', 'group', 'active', 'grade', 'dorm', 'name_kana'],
  },
  meal_logs: {
    name: 'meal_logs',
    // dorm（1寮/2寮）は既存データの列位置を崩さないよう末尾に追加
    headers: ['date', 'member_id', 'breakfast', 'dinner', 'dorm'],
  },
  guest_meals: {
    name: 'guest_meals',
    // category（見学高校生/寮外生/寮管）は既存データの列位置を崩さないよう末尾に追加
    headers: ['date', 'school', 'name', 'breakfast', 'dinner', 'dorm', 'category'],
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
      'motivation_count',
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
    // 配達代と同じイメージで、自由に名前を付けて追加できる費用項目
    // subsidy（チーム補助額）は既存データの列位置を崩さないよう末尾に追加
    name: 'other_items',
    headers: ['year_month', 'member_id', 'name', 'amount', 'subsidy'],
  },
  config: {
    name: 'config',
    headers: ['key', 'value'],
  },
  dorm_transfers: {
    // 寮間移動の「取り消し」用メタデータ。移動登録のたびに1件追加し、
    // 取り消し実行時にその行を削除する（後日でも取り消せるようにするため、
    // 画面のstateではなくシートに永続化する）。
    // member_names/previous_members/created_logs は配列を JSON 文字列として保存する
    name: 'dorm_transfers',
    headers: [
      'id',
      'year_month',
      'dorm',
      'created_at',
      'member_names_json',
      'previous_members_json',
      'created_logs_json',
    ],
  },
  users: {
    // ログインできる人のマスタ。PIN は平文では保存せず、
    // ソルト付きハッシュ（pin_hash）のみを保存します。
    name: 'users',
    headers: [
      'id',
      'name',
      'email',
      'pin_hash',
      'pin_salt',
      'active',
      'created_at',
    ],
  },
  sessions: {
    // ログイン中のセッション。トークンには十分なランダム性があるため
    // これ自体は機密情報ではありませんが、期限切れの掃除を行います。
    name: 'sessions',
    headers: ['token', 'user_id', 'email', 'created_at', 'expires_at'],
  },
};

var DEFAULT_CONFIG = [
  ['breakfast_price', 400],
  ['dinner_price', 600],
  ['base_club_fee', 3000],
];

// ---- 認証まわりの設定 ----------------------------------------
// セッションの有効期限（ミリ秒）: 30日
var SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// PIN 総当たり対策: この回数連続で失敗したらロック
var LOGIN_MAX_ATTEMPTS = 5;
// ロックする時間（秒）: CacheService の最大保持時間(6時間)以内
var LOGIN_LOCKOUT_SECONDS = 15 * 60;

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

    // ログイン不要な action（それ以外は全て有効なセッションを要求）
    var PUBLIC_ACTIONS = { login: true, ping: true };
    var session = null;
    if (!PUBLIC_ACTIONS[action]) {
      session = requireAuth_(params.token);
    }

    switch (action) {
      // ---- 認証 ----
      case 'login':
        data = login(params.email, params.pin);
        break;
      case 'logout':
        data = logout(params.token);
        break;
      case 'whoami':
        data = { user: { name: session.name, email: session.email } };
        break;
      case 'getAccounts':
        data = getAccounts();
        break;
      case 'saveAccounts':
        data = saveAccounts(params.accounts);
        break;
      case 'setAccountPin':
        data = setAccountPin(params.email, params.pin);
        break;

      // ---- データ API（認証必須） ----
      case 'getInitialData':
        data = getInitialData(params.year_month);
        break;
      case 'saveMembers':
        data = saveMembers(params.members);
        break;
      case 'saveConfig':
        data = saveConfig(params.config);
        break;
      case 'saveDormTransferRecord':
        data = saveDormTransferRecord(params.year_month, params.record);
        break;
      case 'deleteDormTransferRecord':
        data = deleteDormTransferRecord(params.id);
        break;
      case 'updateDormTransferRecord':
        data = updateDormTransferRecord(params.id, params.record);
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
    var msg = String((err && err.message) || err);
    if (msg.indexOf('AUTH_REQUIRED:') === 0) {
      return jsonOutput({
        status: 'error',
        code: 'auth_required',
        message: msg.replace('AUTH_REQUIRED:', '').trim(),
      });
    }
    if (msg.indexOf('AUTH_LOCKED:') === 0) {
      return jsonOutput({
        status: 'error',
        code: 'auth_locked',
        message: msg.replace('AUTH_LOCKED:', '').trim(),
      });
    }
    if (msg.indexOf('AUTH_INVALID:') === 0) {
      return jsonOutput({
        status: 'error',
        code: 'auth_invalid',
        message: msg.replace('AUTH_INVALID:', '').trim(),
      });
    }
    return jsonOutput({ status: 'error', message: msg });
  }
}

// JSON レスポンス（CORS 安全なシンプルレスポンス）
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// =============================================================
// 認証 API 実装
// =============================================================
// PIN は平文で保存せず、ユーザーごとのランダムなソルトと
// サーバー側のみが知るペッパー（Script Properties）を混ぜた
// SHA-256 ハッシュのみを保存します。
// 連続ログイン失敗はメールアドレス単位で一時ロックし、
// 総当たり攻撃を防ぎます。
// =============================================================

// ログイン（メールアドレス + PIN） → セッショントークンを発行
function login(email, pin) {
  email = normalizeEmail_(email);
  pin = String(pin || '');

  if (!email || !pin) {
    throw new Error('AUTH_INVALID: メールアドレスとPINを入力してください');
  }
  if (!/^[0-9]{4,8}$/.test(pin)) {
    throw new Error('AUTH_INVALID: PINは4〜8桁の数字で入力してください');
  }

  var cache = CacheService.getScriptCache();
  var lockKey = 'login_fail_' + email;
  var attempts = Number(cache.get(lockKey) || 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    throw new Error(
      'AUTH_LOCKED: PINの入力に複数回失敗したため、しばらく時間をおいてから再度お試しください'
    );
  }

  ensureSheets_();
  var user = findUserByEmail_(email);
  var valid = !!(
    user &&
    user.active &&
    user.pin_hash &&
    verifyPin_(pin, user.pin_salt, user.pin_hash)
  );

  if (!valid) {
    cache.put(lockKey, String(attempts + 1), LOGIN_LOCKOUT_SECONDS);
    throw new Error(
      'AUTH_INVALID: メールアドレスまたはPINが正しくありません'
    );
  }

  cache.remove(lockKey);
  var token = createSession_(user);
  return { token: token, name: user.name, email: user.email };
}

// ログアウト（セッション破棄）
function logout(token) {
  token = String(token || '');
  if (!token) return { ok: true };
  var sheet = getSheet_(SHEETS.sessions.name);
  var values = getBody_(sheet);
  var kept = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '') continue;
    if (String(row[0]) === token) continue; // 削除対象
    kept.push(row);
  }
  clearBody_(sheet);
  if (kept.length) {
    sheet
      .getRange(2, 1, kept.length, SHEETS.sessions.headers.length)
      .setValues(kept);
  }
  return { ok: true };
}

// トークンを検証し、有効なら { userId, email, name } を返す。
// 無効・期限切れ・アカウント無効化済みの場合は AUTH_REQUIRED を throw する。
function requireAuth_(token) {
  ensureSheets_();
  token = String(token || '');
  if (!token) {
    throw new Error('AUTH_REQUIRED: ログインが必要です');
  }
  var sheet = getSheet_(SHEETS.sessions.name);
  var values = getBody_(sheet);
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '') continue;
    if (String(row[0]) !== token) continue;
    var expires = new Date(row[4]);
    if (expires.getTime() <= Date.now()) break;
    var user = findUserById_(Number(row[1]));
    if (!user || !user.active) break;
    return { userId: user.id, email: user.email, name: user.name };
  }
  throw new Error('AUTH_REQUIRED: ログインが必要です');
}

// ログイン可能な人の一覧を取得（PINハッシュ等の機密情報は含めない）
function getAccounts() {
  ensureSheets_();
  var sheet = getSheet_(SHEETS.users.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    out.push({
      id: Number(r[0]),
      name: String(r[1]),
      email: String(r[2]),
      active: toBool_(r[5]),
      hasPin: String(r[3] || '') !== '',
    });
  }
  return out;
}

// ログイン可能な人の一覧を全置換保存（名前・メール・在籍状態のみ）
// PIN は id が一致する既存行から引き継ぐ（新規行は PIN 未設定のまま）。
function saveAccounts(accounts) {
  ensureSheets_();
  accounts = accounts || [];
  var sheet = getSheet_(SHEETS.users.name);
  var headers = SHEETS.users.headers;
  var existing = getBody_(sheet);

  var pinById = {};
  for (var i = 0; i < existing.length; i++) {
    var row = existing[i];
    if (row[0] === '' && row[1] === '') continue;
    pinById[String(row[0])] = {
      hash: row[3],
      salt: row[4],
      created_at: row[6],
    };
  }

  clearBody_(sheet);
  var rows = [];
  for (var j = 0; j < accounts.length; j++) {
    var a = accounts[j];
    var prev = pinById[String(a.id)] || {};
    rows.push([
      Number(a.id),
      String(a.name || ''),
      normalizeEmail_(a.email),
      prev.hash || '',
      prev.salt || '',
      toBool_(a.active),
      prev.created_at || new Date().toISOString(),
    ]);
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  return { saved: accounts.length };
}

// 指定メールアドレスの PIN を新規設定・再設定する
function setAccountPin(email, pin) {
  ensureSheets_();
  email = normalizeEmail_(email);
  pin = String(pin || '');
  if (!email) {
    throw new Error('メールアドレスを指定してください');
  }
  if (!/^[0-9]{4,8}$/.test(pin)) {
    throw new Error('PINは4〜8桁の数字で入力してください');
  }

  var sheet = getSheet_(SHEETS.users.name);
  var values = getBody_(sheet);
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '' && row[1] === '') continue;
    if (normalizeEmail_(String(row[2])) === email) {
      var salt = generateSalt_();
      var hash = hashPin_(pin, salt);
      // pin_hash（4列目）・pin_salt（5列目）のみ更新
      sheet.getRange(i + 2, 4, 1, 2).setValues([[hash, salt]]);
      return { ok: true };
    }
  }
  throw new Error('該当するアカウントが見つかりません: ' + email);
}

// =============================================================
// 認証 helper
// =============================================================

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function findUserByEmail_(email) {
  email = normalizeEmail_(email);
  var sheet = getSheet_(SHEETS.users.name);
  var values = getBody_(sheet);
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    if (normalizeEmail_(String(r[2])) === email) {
      return rowToUser_(r);
    }
  }
  return null;
}

function findUserById_(id) {
  var sheet = getSheet_(SHEETS.users.name);
  var values = getBody_(sheet);
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' && r[1] === '') continue;
    if (Number(r[0]) === Number(id)) {
      return rowToUser_(r);
    }
  }
  return null;
}

function rowToUser_(r) {
  return {
    id: Number(r[0]),
    name: String(r[1]),
    email: String(r[2]),
    pin_hash: String(r[3] || ''),
    pin_salt: String(r[4] || ''),
    active: toBool_(r[5]),
  };
}

// セッションを1件作成し、トークンを返す
function createSession_(user) {
  cleanupExpiredSessions_();
  var sheet = getSheet_(SHEETS.sessions.name);
  var token = Utilities.getUuid() + Utilities.getUuid();
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_DURATION_MS);
  sheet.appendRow([
    token,
    Number(user.id),
    user.email,
    now.toISOString(),
    expires.toISOString(),
  ]);
  return token;
}

// 期限切れセッションを間引く（sessions シートの肥大化を防ぐ）
function cleanupExpiredSessions_() {
  var sheet = getSheet_(SHEETS.sessions.name);
  var values = getBody_(sheet);
  if (values.length === 0) return;
  var now = Date.now();
  var kept = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '') continue;
    var expires = new Date(row[4]);
    if (expires.getTime() > now) kept.push(row);
  }
  if (kept.length !== values.length) {
    clearBody_(sheet);
    if (kept.length) {
      sheet
        .getRange(2, 1, kept.length, SHEETS.sessions.headers.length)
        .setValues(kept);
    }
  }
}

// PIN はサーバー側のみが知るペッパー（初回アクセス時に自動生成し
// Script Properties に保存）とユーザーごとのソルトを混ぜて
// SHA-256 でハッシュ化する。平文 PIN は一切保存しない。
function getPinPepper_() {
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('PIN_PEPPER');
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('PIN_PEPPER', pepper);
  }
  return pepper;
}

function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function hashPin_(pin, salt) {
  var raw = salt + ':' + pin + ':' + getPinPepper_();
  var digestBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < digestBytes.length; i++) {
    var v = digestBytes[i];
    if (v < 0) v += 256;
    var h = v.toString(16);
    hex += h.length === 1 ? '0' + h : h;
  }
  return hex;
}

function verifyPin_(pin, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  return hashPin_(pin, salt) === expectedHash;
}

// =============================================================
// 初回セットアップ用：最初の管理者アカウントを作成
// =============================================================
// 下記の名前・メールアドレス・PIN を書き換えてから
// 関数選択で createInitialAdmin_RUN_ME を選び、実行してください。
// 実行後、この関数の中身は削除してしまって構いません。
function createInitialAdmin_RUN_ME() {
  createInitialAdmin('あなたの名前', 'you@example.com', '123456');
}

function createInitialAdmin(name, email, pin) {
  ensureSheets_();
  name = String(name || '').trim();
  email = normalizeEmail_(email);
  pin = String(pin || '');

  if (!name || !email) {
    throw new Error('name と email を指定してください');
  }
  if (!/^[0-9]{4,8}$/.test(pin)) {
    throw new Error('PIN は4〜8桁の数字で指定してください');
  }
  if (findUserByEmail_(email)) {
    throw new Error('既に登録済みのメールアドレスです: ' + email);
  }

  var sheet = getSheet_(SHEETS.users.name);
  var values = getBody_(sheet);
  var maxId = 0;
  for (var i = 0; i < values.length; i++) {
    var id = Number(values[i][0]);
    if (!isNaN(id) && id > maxId) maxId = id;
  }

  var salt = generateSalt_();
  var hash = hashPin_(pin, salt);
  sheet.appendRow([
    maxId + 1,
    name,
    email,
    hash,
    salt,
    true,
    new Date().toISOString(),
  ]);
  Logger.log('管理者アカウントを作成しました: ' + name + ' <' + email + '>');
  return { id: maxId + 1, name: name, email: email };
}

// =============================================================
// API 実装
// =============================================================

// 初期データの読み込みキャッシュ（短時間の再読み込みを高速化する）
// ロード時間短縮のため、同じ年月への読み込みは一定時間キャッシュから返す。
// 書き込み系 API（保存）のあとは該当分のキャッシュを破棄して最新化する。
var INITIAL_DATA_CACHE_TTL_SECONDS = 30;
var INITIAL_DATA_CACHE_KEYS_KEY = 'initial_data_cache_keys';

function initialDataCacheKey_(yearMonth) {
  return 'initial_data_' + yearMonth;
}

// キャッシュした年月を記録しておき、全件破棄（メンバー保存時）に使う
function trackInitialDataCacheKey_(cache, yearMonth) {
  try {
    var raw = cache.get(INITIAL_DATA_CACHE_KEYS_KEY);
    var keys = raw ? JSON.parse(raw) : [];
    if (keys.indexOf(yearMonth) === -1) {
      keys.push(yearMonth);
      cache.put(
        INITIAL_DATA_CACHE_KEYS_KEY,
        JSON.stringify(keys),
        INITIAL_DATA_CACHE_TTL_SECONDS
      );
    }
  } catch (e) {
    // キャッシュ管理の失敗は致命的ではないため無視
  }
}

// 指定年月のキャッシュを破棄（食数・経費の保存後に呼ぶ）
function invalidateInitialDataCache_(yearMonth) {
  CacheService.getScriptCache().remove(initialDataCacheKey_(yearMonth));
}

// 全年月のキャッシュを破棄（寮生マスターは全月に影響するため）
function invalidateAllInitialDataCache_() {
  var cache = CacheService.getScriptCache();
  try {
    var raw = cache.get(INITIAL_DATA_CACHE_KEYS_KEY);
    var keys = raw ? JSON.parse(raw) : [];
    if (keys.length) cache.removeAll(keys.map(initialDataCacheKey_));
    cache.remove(INITIAL_DATA_CACHE_KEYS_KEY);
  } catch (e) {
    // 追跡情報が壊れていても致命的ではない
  }
}

// 初期データ一括取得
function getInitialData(yearMonth) {
  var cache = CacheService.getScriptCache();
  var cacheKey = initialDataCacheKey_(yearMonth);
  try {
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // キャッシュ取得に失敗しても読み込み自体は継続する
  }

  ensureSheets_();
  var members = readMembers_();
  var config = readConfig_();
  var mealLogs = readMealLogs_(yearMonth);
  var guestMeals = readGuestMeals_(yearMonth);
  var expenses = readExpenses_(yearMonth);
  var tournamentItems = readTournamentItems_(yearMonth);
  var campItems = readCampItems_(yearMonth);
  var otherItems = readOtherItems_(yearMonth);
  var dormTransfers = readDormTransfers_(yearMonth);
  var result = {
    members: members,
    config: config,
    mealLogs: mealLogs,
    guestMeals: guestMeals,
    expenses: expenses,
    tournamentItems: tournamentItems,
    campItems: campItems,
    otherItems: otherItems,
    dormTransfers: dormTransfers,
  };

  try {
    // CacheService は1件あたり100KB程度が上限。超える場合は例外になるため
    // キャッシュを諦めて（catch して）そのまま結果を返す。
    cache.put(cacheKey, JSON.stringify(result), INITIAL_DATA_CACHE_TTL_SECONDS);
    trackInitialDataCacheKey_(cache, yearMonth);
  } catch (e) {
    // noop
  }

  return result;
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
        String(m.name_kana || ''),
      ];
    });
    // ループ内 setValue を避け setValues で一括書き込み
    sheet.getRange(2, 1, rows.length, SHEETS.members.headers.length).setValues(rows);
  }
  invalidateAllInitialDataCache_();
  return { saved: members.length };
}

// 規定（食費単価・部費・清算ルールメモ）全置換保存
// config はキー・バリュー形式なので、任意のキーをそのまま書き込む
function saveConfig(config) {
  ensureSheets_();
  config = config || {};
  var sheet = getSheet_(SHEETS.config.name);
  clearBody_(sheet);
  var rows = [];
  for (var key in config) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
    rows.push([key, config[key]]);
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, SHEETS.config.headers.length).setValues(rows);
  }
  // 規定は全年月の取得結果に含まれるため、キャッシュ済みの全年月を破棄する
  invalidateAllInitialDataCache_();
  return { saved: rows.length };
}

// 寮間移動の「取り消し」用メタデータを1件追加する
// record: { dorm, memberNames, previousMembers, createdLogs }
function saveDormTransferRecord(yearMonth, record) {
  ensureSheets_();
  record = record || {};
  var sheet = getSheet_(SHEETS.dorm_transfers.name);
  var headers = SHEETS.dorm_transfers.headers;
  var values = getBody_(sheet);
  var id = Utilities.getUuid();
  var createdAt = new Date().toISOString();
  var newRow = [
    id,
    String(yearMonth || ''),
    String(record.dorm || ''),
    createdAt,
    JSON.stringify(record.memberNames || []),
    JSON.stringify(record.previousMembers || []),
    JSON.stringify(record.createdLogs || []),
  ];
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === '') continue;
    out.push(values[i]);
  }
  out.push(newRow);
  clearBody_(sheet);
  sheet.getRange(2, 1, out.length, headers.length).setValues(out);
  invalidateInitialDataCache_(yearMonth);
  return {
    id: id,
    yearMonth: String(yearMonth || ''),
    dorm: record.dorm || '',
    createdAt: createdAt,
    memberNames: record.memberNames || [],
    previousMembers: record.previousMembers || [],
    createdLogs: record.createdLogs || [],
  };
}

// 寮間移動の「取り消し」用メタデータを1件削除する
// （取り消し実行後、または「取り消さずにこの通知を消す」操作の両方から呼ばれる）
function deleteDormTransferRecord(id) {
  ensureSheets_();
  var sheet = getSheet_(SHEETS.dorm_transfers.name);
  var headers = SHEETS.dorm_transfers.headers;
  var values = getBody_(sheet);
  var kept = [];
  var removedYearMonth = '';
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '') continue;
    if (String(row[0]) === String(id)) {
      removedYearMonth = String(row[1] || '');
      continue;
    }
    kept.push(row);
  }
  clearBody_(sheet);
  if (kept.length) {
    sheet.getRange(2, 1, kept.length, headers.length).setValues(kept);
  }
  if (removedYearMonth) invalidateInitialDataCache_(removedYearMonth);
  return { ok: true };
}

// 寮間移動の「取り消し」用メタデータのうち、1件を書き換える
// （複数人まとめて登録した移動から、特定の1人だけを取り消して除外する場合に使う。
//   id・year_month・dorm・created_at は変更せず、対象者一覧の3項目だけ上書きする）
function updateDormTransferRecord(id, record) {
  ensureSheets_();
  record = record || {};
  var sheet = getSheet_(SHEETS.dorm_transfers.name);
  var headers = SHEETS.dorm_transfers.headers;
  var values = getBody_(sheet);
  var out = [];
  var updated = null;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '') continue;
    if (String(row[0]) === String(id)) {
      var newRow = [
        row[0],
        row[1],
        row[2],
        row[3],
        JSON.stringify(record.memberNames || []),
        JSON.stringify(record.previousMembers || []),
        JSON.stringify(record.createdLogs || []),
      ];
      out.push(newRow);
      updated = {
        id: String(row[0]),
        yearMonth: String(row[1]),
        dorm: String(row[2] || ''),
        createdAt: String(row[3] || ''),
        memberNames: record.memberNames || [],
        previousMembers: record.previousMembers || [],
        createdLogs: record.createdLogs || [],
      };
      continue;
    }
    out.push(row);
  }
  clearBody_(sheet);
  if (out.length) {
    sheet.getRange(2, 1, out.length, headers.length).setValues(out);
  }
  if (updated) invalidateInitialDataCache_(updated.yearMonth);
  return updated;
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

  invalidateInitialDataCache_(yearMonth);
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
      row[6] != null && row[6] !== '' ? String(row[6]) : '見学高校生',
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
      String(guests[g].category || '見学高校生'),
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

  // --- monthly_expenses（治療/配達代/ウエア/モチベーション費補助）を UPSERT ---
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
      num_(e.motivation_count),
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
        num_(o.subsidy),
      ];
    })
  );

  invalidateInitialDataCache_(yearMonth);
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
      name_kana: r[7] != null ? String(r[7]) : '',
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
      category: r[6] != null && r[6] !== '' ? String(r[6]) : '見学高校生',
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
      motivation_count: num_(r[10]),
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
      subsidy: num_(r[4]),
    });
  }
  return out;
}

// 指定年月の寮間移動「取り消し」用メタデータを読み込む
function readDormTransfers_(yearMonth) {
  var sheet = getSheet_(SHEETS.dorm_transfers.name);
  var values = getBody_(sheet);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '') continue;
    if (yearMonth && String(r[1]) !== yearMonth) continue;
    var memberNames = [];
    var previousMembers = [];
    var createdLogs = [];
    try {
      memberNames = JSON.parse(r[4] || '[]');
    } catch (e) {}
    try {
      previousMembers = JSON.parse(r[5] || '[]');
    } catch (e) {}
    try {
      createdLogs = JSON.parse(r[6] || '[]');
    } catch (e) {}
    out.push({
      id: String(r[0]),
      yearMonth: String(r[1]),
      dorm: String(r[2] || ''),
      createdAt: String(r[3] || ''),
      memberNames: memberNames,
      previousMembers: previousMembers,
      createdLogs: createdLogs,
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
