-- 员工考勤系统 - 测试数据（一步到位版）

-- 1. 先清空现有数据（避免冲突）
TRUNCATE TABLE overtime_records, leave_requests, attendance_records, employees CASCADE;

-- 2. 插入员工（使用 RETURNING 获取实际 ID）
WITH inserted_employees AS (
  INSERT INTO employees (name, employee_no, department, position, email, role, password, status) 
  VALUES
    ('管理员', 'ADMIN001', '技术部', '经理', 'admin@test.com', 'admin', 'admin123', 'active'),
    ('张三', 'EMP001', '技术部', '工程师', 'zhangsan@test.com', 'employee', '123456', 'active'),
    ('李四', 'EMP002', '市场部', '专员', 'lisi@test.com', 'employee', '123456', 'active')
  RETURNING id, name, employee_no
)
SELECT * FROM inserted_employees;

-- 3. 插入考勤记录（使用子查询确保 ID 正确）
INSERT INTO attendance_records (employee_id, date, check_in, check_out, status) 
SELECT id, CURRENT_DATE, '08:55:00', '18:05:00', 'normal' FROM employees WHERE employee_no = 'ADMIN001'
UNION ALL
SELECT id, CURRENT_DATE, '09:10:00', NULL, 'late' FROM employees WHERE employee_no = 'EMP001'
UNION ALL
SELECT id, CURRENT_DATE, '08:50:00', '18:00:00', 'normal' FROM employees WHERE employee_no = 'EMP002';

-- 4. 插入请假记录
INSERT INTO leave_requests (employee_id, start_date, end_date, type, status, reason) 
SELECT id, CURRENT_DATE + 1, CURRENT_DATE + 3, 'annual', 'approved', '年假休息' 
FROM employees WHERE employee_no = 'EMP001';

-- 5. 插入加班记录
INSERT INTO overtime_records (employee_id, date, hours, status, notes) 
SELECT id, CURRENT_DATE - 1, 3.0, 'approved', '项目上线加班' 
FROM employees WHERE employee_no = 'ADMIN001';

-- 6. 查看插入结果
SELECT '=== 员工表 ===' as info;
SELECT id, name, employee_no, department, role, status FROM employees;

SELECT '=== 考勤记录 ===' as info;
SELECT a.id, e.name, a.date, a.check_in, a.check_out, a.status 
FROM attendance_records a JOIN employees e ON a.employee_id = e.id;

SELECT '=== 请假记录 ===' as info;
SELECT l.id, e.name, l.start_date, l.end_date, l.type, l.status 
FROM leave_requests l JOIN employees e ON l.employee_id = e.id;

SELECT '=== 加班记录 ===' as info;
SELECT o.id, e.name, o.date, o.hours, o.status 
FROM overtime_records o JOIN employees e ON o.employee_id = e.id;
