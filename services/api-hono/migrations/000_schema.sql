-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建Excel数据表
CREATE TABLE IF NOT EXISTS excel_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  display_time TEXT,
  scheduled_publish BOOLEAN DEFAULT 0,
  FOREIGN KEY (uploaded_by) REFERENCES users (id)
);

-- 创建Excel数据表
CREATE TABLE IF NOT EXISTS excel_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  sheet_name TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  data TEXT NOT NULL, -- JSON字符串存储行数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES excel_files (id)
);

-- 创建Excel文件权限表
CREATE TABLE IF NOT EXISTS excel_file_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  granted_by INTEGER NOT NULL, -- 谁分配的权限
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES excel_files (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (granted_by) REFERENCES users (id),
  UNIQUE(file_id, user_id) -- 防止重复权限
);

-- 插入默认超级管理员用户 (密码: admin123)
INSERT OR IGNORE INTO users (username, password, role, email) 
VALUES ('admin', '$2a$10$rYTfCLixuGU9fPkEVcfk9eQSV/cAX8.krX5yTQh859J2wjOT1PsTy', 'admin', 'admin@example.com');

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_excel_files_uploaded_by ON excel_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_excel_files_display_time ON excel_files(display_time);
CREATE INDEX IF NOT EXISTS idx_excel_files_scheduled_publish ON excel_files(scheduled_publish);
CREATE INDEX IF NOT EXISTS idx_excel_data_file_id ON excel_data(file_id);
CREATE INDEX IF NOT EXISTS idx_excel_data_sheet_name ON excel_data(sheet_name);
CREATE INDEX IF NOT EXISTS idx_permissions_file_id ON excel_file_permissions(file_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON excel_file_permissions(user_id);
