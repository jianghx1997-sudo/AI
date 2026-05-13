const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'wardrobe.db');
const CLOTHES_JSON = path.join(DATA_DIR, 'clothes.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
  } else {
    console.log('✅ SQLite 数据库已连接');
  }
});

// 初始化表
function initTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS clothes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

function initRecommendationTables() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS recommendation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outfit_name TEXT,
        occasion TEXT,
        weather TEXT,
        temperature REAL,
        item_ids TEXT,
        feedback TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function initWearLogTables() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS wear_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  // 添加衣物
  addCloth: (cloth) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const {
        name, image_path, brand, purchase_date, category, color, season,
        material, style, occasion, fit, tags, confidence, source
      } = cloth;

      db.run(
        `INSERT INTO clothes (
          name, image_path, brand, purchase_date, category, color, season,
          material, style, occasion, fit, tags, confidence, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name, image_path, brand || null, purchase_date || null,
          category || '上衣', color || null, season || null,
          material || null, style || null, occasion || '休闲',
          fit || '标准', tags || null, confidence || null,
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
  getClothById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM clothes WHERE id = ?', [parseInt(id)], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  },

  // 更新衣物
  updateCloth: (id, updates) => {
    return new Promise((resolve, reject) => {
      const allowed = [
        'name', 'image_path', 'brand', 'purchase_date', 'category', 'color',
        'season', 'material', 'style', 'occasion', 'fit', 'tags'
      ];
      const keys = Object.keys(updates).filter(k => allowed.includes(k));
      if (keys.length === 0) return resolve(null);

      const sets = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => updates[k]);
      values.push(new Date().toISOString());
      values.push(parseInt(id));

      db.run(
        `UPDATE clothes SET ${sets}, updated_at = ? WHERE id = ?`,
        values,
        function (err) {
          if (err) return reject(err);
          resolve({ updated: this.changes > 0 });
        }
      );
    });
  },

  // 删除衣物
  deleteCloth: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM clothes WHERE id = ?', [parseInt(id)], function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes > 0 });
      });
    });
  },

  // 获取分类统计
  getCategoryStats: () => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT category, COUNT(*) as count FROM clothes GROUP BY category',
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => ({ category: r.category, count: r.count })));
        }
      );
    });
  },

  // 切换收藏状态
  toggleFavorite: (id) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE clothes SET is_favorite = NOT is_favorite, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), parseInt(id)],
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

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          `INSERT INTO wear_logs (cloth_id, worn_at, occasion, weather, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
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
              'UPDATE clothes SET wear_count = wear_count + 1, last_worn = ?, updated_at = ? WHERE id = ?',
              [details.worn_at || now, now, clothId],
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

  getWearLogs: ({ clothId, limit = 20 } = {}) => {
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

      sql += ' ORDER BY wear_logs.worn_at DESC, wear_logs.id DESC LIMIT ?';
      params.push(Number(limit) || 20);

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  addRecommendationLog: (log) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const itemIds = Array.isArray(log.item_ids) ? JSON.stringify(log.item_ids) : (log.item_ids || '[]');
      db.run(
        `INSERT INTO recommendation_logs (
          outfit_name, occasion, weather, temperature, item_ids, feedback, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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

  getRecommendationLogs: ({ limit = 80 } = {}) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT *
         FROM recommendation_logs
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [Number(limit) || 80],
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
    await initTable();
    await initRecommendationTables();
    await initWearLogTables();
    await migrateFromJson();
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
