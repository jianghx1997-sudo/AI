const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const DB_PATH = process.env.WARDROBE_DB_PATH || process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.WARDROBE_DB_PATH || process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'wardrobe.db');
const DB_DIR = path.dirname(DB_PATH);
const CLOTHES_JSON = path.join(DATA_DIR, 'clothes.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
  } else {
    console.log('✅ SQLite 数据库已连接');
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function tableHasColumn(tableName, columnName) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  return columns.some(column => column.name === columnName);
}

async function ensureColumn(tableName, columnName, definition) {
  if (await tableHasColumn(tableName, columnName)) return;
  await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function sanitizeUser(row) {
  if (!row) return null;
  const { password_hash, ...safeUser } = row;
  return safeUser;
}

function isDefaultDemoPassword() {
  return !process.env.DEMO_USER_PASSWORD;
}

async function initSchemaMigrationsTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function hasMigration(id) {
  const row = await get('SELECT id FROM schema_migrations WHERE id = ?', [id]);
  return Boolean(row);
}

async function recordMigration(id) {
  await run(
    'INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)',
    [id, new Date().toISOString()]
  );
}

async function applyMigration(id, up) {
  if (await hasMigration(id)) return;
  await up();
  await recordMigration(id);
}

async function runSchemaMigrations() {
  await applyMigration('20260514_core_query_indexes', async () => {
    await run('CREATE INDEX IF NOT EXISTS idx_clothes_user_created ON clothes(user_id, created_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_clothes_user_category ON clothes(user_id, category)');
    await run('CREATE INDEX IF NOT EXISTS idx_clothes_user_season ON clothes(user_id, season)');
    await run('CREATE INDEX IF NOT EXISTS idx_clothes_user_favorite ON clothes(user_id, is_favorite)');
    await run('CREATE INDEX IF NOT EXISTS idx_clothes_user_updated ON clothes(user_id, updated_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_wear_logs_user_worn ON wear_logs(user_id, worn_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_wear_logs_cloth_worn ON wear_logs(cloth_id, worn_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_recommendation_logs_user_created ON recommendation_logs(user_id, created_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_recommendation_logs_snapshot ON recommendation_logs(recommendation_snapshot_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_recommendation_snapshots_user_created ON recommendation_snapshots(user_id, created_at)');
  });
}

// 初始化表
function initUsersTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function initTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS clothes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        brand TEXT,
        purchase_date TEXT,
        category TEXT NOT NULL DEFAULT '上衣',
        color TEXT,
        season TEXT,
        material TEXT,
        style TEXT,
        occasion TEXT DEFAULT '休闲',
        fit TEXT DEFAULT '标准',
        warmth_level REAL,
        breathability_level REAL,
        formality_level REAL,
        layering_role TEXT,
        color_family TEXT,
        weather_risk TEXT,
        is_favorite INTEGER DEFAULT 0,
        wear_count INTEGER DEFAULT 0,
        last_worn TEXT,
        tags TEXT,
        confidence REAL,
        source TEXT DEFAULT 'mock',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initRecommendationTables() {
  await run(`
    CREATE TABLE IF NOT EXISTS recommendation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      recommendation_snapshot_id INTEGER,
      outfit_key TEXT,
      outfit_name TEXT,
      occasion TEXT,
      weather TEXT,
      temperature REAL,
      item_ids TEXT,
      feedback TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS recommendation_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      occasion TEXT,
      weather TEXT,
      temperature REAL,
      city TEXT,
      ai_review_enabled INTEGER DEFAULT 0,
      request_context TEXT,
      result_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

}

function initWearLogTables() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS wear_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        cloth_id INTEGER NOT NULL,
        worn_at TEXT NOT NULL,
        occasion TEXT,
        weather TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function ensureUserColumns() {
  await ensureColumn('clothes', 'user_id', 'INTEGER');
  await ensureColumn('clothes', 'warmth_level', 'REAL');
  await ensureColumn('clothes', 'breathability_level', 'REAL');
  await ensureColumn('clothes', 'formality_level', 'REAL');
  await ensureColumn('clothes', 'layering_role', 'TEXT');
  await ensureColumn('clothes', 'color_family', 'TEXT');
  await ensureColumn('clothes', 'weather_risk', 'TEXT');
  await ensureColumn('wear_logs', 'user_id', 'INTEGER');
  await ensureColumn('recommendation_logs', 'user_id', 'INTEGER');
  await ensureColumn('recommendation_logs', 'recommendation_snapshot_id', 'INTEGER');
  await ensureColumn('recommendation_logs', 'outfit_key', 'TEXT');
}

async function ensureDefaultUser() {
  const existing = await get('SELECT * FROM users WHERE username = ?', ['demo']);
  if (existing) {
    if (process.env.DEMO_USER_PASSWORD) {
      const matches = await bcrypt.compare(process.env.DEMO_USER_PASSWORD, existing.password_hash);
      if (!matches) {
        const passwordHash = await bcrypt.hash(process.env.DEMO_USER_PASSWORD, 10);
        await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
          passwordHash,
          new Date().toISOString(),
          existing.id
        ]);
        return get('SELECT * FROM users WHERE id = ?', [existing.id]);
      }
    }
    return existing;
  }

  const now = new Date().toISOString();
  const demoPassword = process.env.DEMO_USER_PASSWORD || 'demo123456';
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const result = await run(
    `INSERT INTO users (username, password_hash, display_name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['demo', passwordHash, '默认用户', 'user', now, now]
  );

  if (isDefaultDemoPassword()) {
    console.warn('⚠️ DEMO_USER_PASSWORD 未配置，默认 demo 密码为 demo123456，仅适合本地开发');
  }

  return get('SELECT * FROM users WHERE id = ?', [result.lastID]);
}

async function assignLegacyRowsToUser(userId) {
  await run('UPDATE clothes SET user_id = ? WHERE user_id IS NULL', [userId]);
  await run('UPDATE wear_logs SET user_id = ? WHERE user_id IS NULL', [userId]);
  await run('UPDATE recommendation_logs SET user_id = ? WHERE user_id IS NULL', [userId]);
}

// 从 JSON 迁移已有数据
async function migrateFromJson() {
  if (process.env.MIGRATE_JSON_ON_EMPTY !== 'true') {
    console.log('📦 默认跳过旧 JSON 自动迁移。如需迁移，设置 MIGRATE_JSON_ON_EMPTY=true');
    return;
  }

  const count = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM clothes', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });

  if (count > 0) {
    console.log(`📦 数据库已有 ${count} 条衣物记录，跳过 JSON 迁移`);
    return;
  }

  if (!fs.existsSync(CLOTHES_JSON)) {
    console.log('📦 无 JSON 数据文件需要迁移');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(CLOTHES_JSON, 'utf8'));
    if (!Array.isArray(data) || data.length === 0) {
      console.log('📦 JSON 数据为空，无需迁移');
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO clothes (
        id, name, image_path, brand, purchase_date, category, color, season,
        material, style, occasion, fit, is_favorite, wear_count, last_worn,
        tags, confidence, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of data) {
      stmt.run(
        item.id,
        item.name,
        item.image_path,
        item.brand || null,
        item.purchase_date || null,
        item.category || '上衣',
        item.color || null,
        item.season || null,
        item.material || null,
        item.style || null,
        item.occasion || '休闲',
        item.fit || '标准',
        item.is_favorite || 0,
        item.wear_count || 0,
        item.last_worn || null,
        item.tags || null,
        item.confidence || null,
        item.source || 'mock',
        item.created_at || new Date().toISOString(),
        item.updated_at || new Date().toISOString()
      );
    }

    stmt.finalize();
    console.log(`📦 已从 JSON 迁移 ${data.length} 条衣物记录到 SQLite`);
  } catch (e) {
    console.error('❌ JSON 迁移失败:', e.message);
  }
}

// 封装数据库操作
const dbAsync = {
  createUser: ({ username, password_hash, display_name, avatar_url, role = 'user' }) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO users (username, password_hash, display_name, avatar_url, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, password_hash, display_name || username, avatar_url || null, role, now, now],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            username,
            display_name: display_name || username,
            avatar_url: avatar_url || null,
            role,
            created_at: now,
            updated_at: now
          });
        }
      );
    });
  },

  getUserByUsername: (username) => {
    return get('SELECT * FROM users WHERE username = ?', [username]);
  },

  getUserById: async (id) => {
    const user = await get('SELECT * FROM users WHERE id = ?', [parseInt(id)]);
    return sanitizeUser(user);
  },

  getUserWithPasswordById: (id) => {
    return get('SELECT * FROM users WHERE id = ?', [parseInt(id)]);
  },

  updateUser: (id, updates) => {
    return new Promise((resolve, reject) => {
      const allowed = ['display_name', 'avatar_url'];
      const keys = Object.keys(updates).filter(key => allowed.includes(key));
      if (keys.length === 0) return resolve(null);

      const sets = keys.map(key => `${key} = ?`).join(', ');
      const values = keys.map(key => updates[key]);
      values.push(new Date().toISOString());
      values.push(parseInt(id));

      db.run(
        `UPDATE users SET ${sets}, updated_at = ? WHERE id = ?`,
        values,
        function (err) {
          if (err) return reject(err);
          resolve({ updated: this.changes > 0 });
        }
      );
    });
  },

  // 添加衣物
  addCloth: (cloth) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const {
        name, image_path, brand, purchase_date, category, color, season,
        material, style, occasion, fit, tags, confidence, source, user_id,
        warmth_level, breathability_level, formality_level, layering_role,
        color_family, weather_risk
      } = cloth;

      db.run(
        `INSERT INTO clothes (
          user_id, name, image_path, brand, purchase_date, category, color, season,
          material, style, occasion, fit, warmth_level, breathability_level,
          formality_level, layering_role, color_family, weather_risk,
          tags, confidence, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id || null, name, image_path, brand || null, purchase_date || null,
          category || '上衣', color || null, season || null,
          material || null, style || null, occasion || '休闲',
          fit || '标准', warmth_level ?? null, breathability_level ?? null,
          formality_level ?? null, layering_role || null, color_family || null,
          weather_risk || null, tags || null, confidence || null,
          source || 'mock', now, now
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, ...cloth, created_at: now, updated_at: now });
        }
      );
    });
  },

  // 获取所有衣物（支持筛选）
  getAllClothes: (filters = {}) => {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM clothes WHERE 1=1';
      const params = [];

      if (filters.userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(filters.userId));
      }
      if (filters.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }
      if (filters.color) {
        sql += ' AND color = ?';
        params.push(filters.color);
      }
      if (filters.season) {
        sql += ' AND season = ?';
        params.push(filters.season);
      }
      if (filters.occasion) {
        sql += ' AND occasion = ?';
        params.push(filters.occasion);
      }
      if (filters.is_favorite !== undefined) {
        sql += ' AND is_favorite = ?';
        params.push(filters.is_favorite ? 1 : 0);
      }
      if (filters.search) {
        sql += ` AND (
          name LIKE ?
          OR category LIKE ?
          OR color LIKE ?
          OR season LIKE ?
          OR material LIKE ?
          OR style LIKE ?
          OR occasion LIKE ?
          OR brand LIKE ?
          OR tags LIKE ?
        )`;
        const keyword = `%${filters.search}%`;
        params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword);
      }

      sql += ' ORDER BY created_at DESC';

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  // 根据ID获取衣物
  getClothById: (id, userId) => {
    return new Promise((resolve, reject) => {
      const params = [parseInt(id)];
      let sql = 'SELECT * FROM clothes WHERE id = ?';
      if (userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(userId));
      }
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  },

  // 更新衣物
  updateCloth: (id, updates, userId) => {
    return new Promise((resolve, reject) => {
      const allowed = [
        'name', 'image_path', 'brand', 'purchase_date', 'category', 'color',
        'season', 'material', 'style', 'occasion', 'fit', 'tags',
        'warmth_level', 'breathability_level', 'formality_level',
        'layering_role', 'color_family', 'weather_risk'
      ];
      const keys = Object.keys(updates).filter(k => allowed.includes(k));
      if (keys.length === 0) return resolve(null);

      const sets = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => updates[k]);
      values.push(new Date().toISOString());
      values.push(parseInt(id));
      if (userId) values.push(parseInt(userId));

      db.run(
        `UPDATE clothes SET ${sets}, updated_at = ? WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
        values,
        function (err) {
          if (err) return reject(err);
          resolve({ updated: this.changes > 0 });
        }
      );
    });
  },

  // 删除衣物
  deleteCloth: (id, userId) => {
    return new Promise((resolve, reject) => {
      const params = [parseInt(id)];
      let sql = 'DELETE FROM clothes WHERE id = ?';
      if (userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(userId));
      }
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  },

  // 获取分类统计
  getCategoryStats: (userId) => {
    return new Promise((resolve, reject) => {
      const params = [];
      let sql = 'SELECT category, COUNT(*) as count FROM clothes WHERE 1=1';
      if (userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(userId));
      }
      sql += ' GROUP BY category';
      db.all(
        sql,
        params,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => ({ category: r.category, count: r.count })));
        }
      );
    });
  },

  // 切换收藏状态
  toggleFavorite: (id, userId) => {
    return new Promise((resolve, reject) => {
      const params = [new Date().toISOString(), parseInt(id)];
      let sql = 'UPDATE clothes SET is_favorite = NOT is_favorite, updated_at = ? WHERE id = ?';
      if (userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(userId));
      }
      db.run(
        sql,
        params,
        function (err) {
          if (err) return reject(err);
          resolve({ updated: this.changes > 0 });
        }
      );
    });
  },

  // 记录穿着
  recordWear: (id, details = {}) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const clothId = parseInt(id);
      const userId = details.user_id ? parseInt(details.user_id) : null;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          `INSERT INTO wear_logs (user_id, cloth_id, worn_at, occasion, weather, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            clothId,
            details.worn_at || now,
            details.occasion || null,
            details.weather || null,
            details.note || null,
            now
          ],
          function (insertErr) {
            if (insertErr) {
              db.run('ROLLBACK');
              return reject(insertErr);
            }

            const wearLogId = this.lastID;
            db.run(
              `UPDATE clothes SET wear_count = wear_count + 1, last_worn = ?, updated_at = ? WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
              userId ? [details.worn_at || now, now, clothId, userId] : [details.worn_at || now, now, clothId],
              function (updateErr) {
                if (updateErr) {
                  db.run('ROLLBACK');
                  return reject(updateErr);
                }

                const updateChanges = this.changes;
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) return reject(commitErr);
                  resolve({
                    updated: updateChanges > 0,
                    wear_log: {
                      id: wearLogId,
                      user_id: userId,
                      cloth_id: clothId,
                      worn_at: details.worn_at || now,
                      occasion: details.occasion || null,
                      weather: details.weather || null,
                      note: details.note || null,
                      created_at: now
                    }
                  });
                });
              }
            );
          }
        );
      });
    });
  },

  getWearLogs: ({ clothId, userId, limit = 20 } = {}) => {
    return new Promise((resolve, reject) => {
      const params = [];
      let sql = `
        SELECT wear_logs.*, clothes.name AS cloth_name, clothes.image_path AS image_path
        FROM wear_logs
        LEFT JOIN clothes ON clothes.id = wear_logs.cloth_id
        WHERE 1=1
      `;

      if (clothId) {
        sql += ' AND wear_logs.cloth_id = ?';
        params.push(parseInt(clothId));
      }
      if (userId) {
        sql += ' AND wear_logs.user_id = ?';
        params.push(parseInt(userId));
      }

      sql += ' ORDER BY wear_logs.worn_at DESC, wear_logs.id DESC LIMIT ?';
      params.push(Number(limit) || 20);

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  addRecommendationSnapshot: (snapshot) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const requestContext = JSON.stringify(snapshot.request_context || {});
      const resultJson = JSON.stringify(snapshot.result_json || {});

      db.run(
        `INSERT INTO recommendation_snapshots (
          user_id, occasion, weather, temperature, city, ai_review_enabled,
          request_context, result_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parseInt(snapshot.user_id),
          snapshot.occasion || null,
          snapshot.weather || null,
          snapshot.temperature !== undefined ? Number(snapshot.temperature) : null,
          snapshot.city || null,
          snapshot.ai_review_enabled ? 1 : 0,
          requestContext,
          resultJson,
          now
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, created_at: now });
        }
      );
    });
  },

  getRecommendationSnapshotById: (id, userId) => {
    return get(
      'SELECT * FROM recommendation_snapshots WHERE id = ? AND user_id = ?',
      [parseInt(id), parseInt(userId)]
    );
  },

  addRecommendationLog: (log) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const itemIds = Array.isArray(log.item_ids) ? JSON.stringify(log.item_ids) : (log.item_ids || '[]');
      db.run(
        `INSERT INTO recommendation_logs (
          user_id, recommendation_snapshot_id, outfit_key, outfit_name, occasion,
          weather, temperature, item_ids, feedback, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.user_id || null,
          log.recommendation_snapshot_id || null,
          log.outfit_key || null,
          log.outfit_name || null,
          log.occasion || null,
          log.weather || null,
          log.temperature !== undefined ? Number(log.temperature) : null,
          itemIds,
          log.feedback || 'viewed',
          log.note || null,
          now
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, created_at: now });
        }
      );
    });
  },

  getRecommendationLogs: ({ userId, limit = 80 } = {}) => {
    return new Promise((resolve, reject) => {
      const params = [];
      let sql = 'SELECT * FROM recommendation_logs WHERE 1=1';
      if (userId) {
        sql += ' AND user_id = ?';
        params.push(parseInt(userId));
      }
      sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
      params.push(Number(limit) || 80);
      db.all(
        sql,
        params,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }
};

// 启动时初始化
(async () => {
  try {
    await initUsersTable();
    await initTable();
    await initRecommendationTables();
    await initWearLogTables();
    await ensureUserColumns();
    await initSchemaMigrationsTable();
    await runSchemaMigrations();
    const demoUser = await ensureDefaultUser();
    await migrateFromJson();
    await assignLegacyRowsToUser(demoUser.id);
    const count = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM clothes', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    console.log('✅ 数据库就绪，当前衣物数量:', count);
  } catch (e) {
    console.error('❌ 数据库初始化失败:', e.message);
  }
})();

module.exports = { dbAsync };
