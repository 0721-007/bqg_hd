# bqg_hd 后端

Node.js + Express + PostgreSQL API 服务。

- 运行：`npm install && npm run dev`
- 构建：`npm run build`；启动：`npm start`
- 环境变量：见 `.env.example`
- 数据库迁移：首次启动自动执行 `supabase/migrations/20241130_content_schema.sql`

## 环境变量

- 数据库连接（二选一）：
  - `DATABASE_URL=postgresql://user:pass@host:port/db`（支持在 URL 中添加 `?sslmode=disable|require`）
  - 或使用 `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`
- 管理员口令：`ADMIN_PASSWORD=<strong>`
- 端口：`PORT=3000`
- SSL 控制（可选）：
  - `PGSSLMODE=disable|require` 或 `DB_SSL=true|false`（默认关闭 SSL，如需开启设 `require`/`true`）
