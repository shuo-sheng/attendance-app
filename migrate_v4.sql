-- 考勤系统 v4 数据库迁移
-- 在 Supabase SQL Editor 中执行本脚本
-- https://supabase.com/dashboard/project/fynwxulxkmpongtmwani/sql/new

-- 1. 给 employees 表新增字段
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC(10,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS performance TEXT;

-- 2. 创建 contracts 合同表
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    contract_type TEXT NOT NULL DEFAULT '劳动合同',
    start_date DATE NOT NULL,
    end_date DATE,
    file_url TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 启用 RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略（管理员全部权限，员工只看自己的）
CREATE POLICY "管理员全部权限" ON contracts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "员工查看自己的合同" ON contracts FOR SELECT USING (employee_id IN (SELECT id FROM employees));

-- 5. 索引
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- 验证
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees' AND column_name IN ('hire_date', 'resignation_date', 'salary', 'performance');
SELECT table_name FROM information_schema.tables WHERE table_name = 'contracts';
