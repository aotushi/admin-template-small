// 现在只使用D1数据库，移除SQLite依赖
export class DatabaseWrapper {
  private db: D1Database;

  constructor(database: D1Database) {
    this.db = database;
  }

  async prepare(query: string) {
    return this.db.prepare(query);
  }

  async run(query: string, params: any[] = []) {
    const stmt = this.db.prepare(query);
    return await stmt.bind(...params).run();
  }

  async get(query: string, params: any[] = []) {
    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).first();
    return result;
  }

  async all(query: string, params: any[] = []) {
    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    return result.results;
  }
}

