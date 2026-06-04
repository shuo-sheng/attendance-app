import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase credentials
const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

async function migrate() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      -- 员工表
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        position TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 考勤记录表
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in TIMESTAMPTZ,
        check_out TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'normal',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 请假申请表
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        type TEXT NOT NULL DEFAULT 'annual',
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 加班记录表
      CREATE TABLE IF NOT EXISTS overtime_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        hours NUMERIC(4,1) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, date);
      CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_overtime_employee ON overtime_records(employee_id);
    `
  })
  if (error) {
    console.log('Migration error:', error.message)
    // If exec_sql RPC doesn't exist, print manual SQL for user to run in Supabase SQL Editor
    console.log('\n--- Please run this SQL in your Supabase SQL Editor ---\n')
    console.log(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        position TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in TIMESTAMPTZ,
        check_out TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'normal',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        type TEXT NOT NULL DEFAULT 'annual',
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS overtime_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        hours NUMERIC(4,1) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, date);
      CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_overtime_employee ON overtime_records(employee_id);
    `)
  } else {
    console.log('Migration done!')
  }
}

migrate()
