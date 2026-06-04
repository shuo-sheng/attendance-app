import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fynwxulxkmpongtmwani.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bnd4dWx4a21wb25ndG13YW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODA3NzksImV4cCI6MjA5NjA1Njc3OX0.91rUyo98QlVpbUkwvNW6LP71GGvMm2w8wuFeAT3BNNo'
)

async function migrate() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      -- 补卡申请表
      CREATE TABLE IF NOT EXISTS makeup_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_makeup_employee ON makeup_requests(employee_id);
    `
  })
  
  if (error) {
    console.log('Migration error:', error.message)
    console.log('\n--- 请在 Supabase SQL Editor 执行以下 SQL ---\n')
    console.log(`
      CREATE TABLE IF NOT EXISTS makeup_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `)
  } else {
    console.log('✅ 补卡表创建成功！')
  }
}

migrate()
