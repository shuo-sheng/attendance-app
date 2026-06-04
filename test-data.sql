-- 员工考勤系统 - 测试数据

-- 1. 插入员工数据
INSERT INTO employees (name, department, position, email) VALUES
  ('管理员', '技术部', '经理', 'admin@test.com'),
  ('张三', '技术部', '工程师', 'zhangsan@test.com'),
  ('李四', '市场部', '专员', 'lisi@test.com'),
  ('王五', '技术部', '前端开发', 'wangwu@test.com'),
  ('赵六', '市场部', '市场经理', 'zhaoliu@test.com');

-- 2. 插入今日考勤记录
INSERT INTO attendance_records (employee_id, date, check_in, check_out, status, notes) VALUES
  (1, CURRENT_DATE, '08:55:00', '18:05:00', 'normal', '正常打卡'),
  (2, CURRENT_DATE, '09:10:00', NULL, 'late', '迟到15分钟'),
  (3, CURRENT_DATE, '08:50:00', '18:00:00', 'normal', '正常打卡'),
  (4, CURRENT_DATE, '08:45:00', '18:10:00', 'normal', '正常打卡'),
  (5, CURRENT_DATE, NULL, NULL, 'leave', '请假中');

-- 3. 插入请假申请
INSERT INTO leave_requests (employee_id, start_date, end_date, type, status, reason) VALUES
  (2, CURRENT_DATE + 1, CURRENT_DATE + 3, 'annual', 'approved', '年假休息'),
  (5, CURRENT_DATE, CURRENT_DATE + 2, 'sick', 'pending', '感冒发烧');

-- 4. 插入加班记录
INSERT INTO overtime_records (employee_id, date, hours, status, notes) VALUES
  (1, CURRENT_DATE - 1, 3.0, 'approved', '项目上线加班'),
  (3, CURRENT_DATE - 2, 2.5, 'pending', '需求评审加班');
