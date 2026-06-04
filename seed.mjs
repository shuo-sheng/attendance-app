import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
  console.log('🌱 开始添加测试数据...\n');

  // 1. 添加部门
  const { data: dept1, error: dept1Err } = await supabase
    .from('departments')
    .insert({ name: '技术部', description: '负责产品研发' })
    .select()
    .single();
  
  const { data: dept2, error: dept2Err } = await supabase
    .from('departments')
    .insert({ name: '市场部', description: '负责市场推广' })
    .select()
    .single();

  if (dept1Err || dept2Err) {
    console.error('❌ 部门添加失败:', dept1Err || dept2Err);
    return;
  }
  console.log('✅ 部门添加成功：技术部、市场部');

  // 2. 添加管理员
  const { data: admin, error: adminErr } = await supabase
    .from('employees')
    .insert({
      name: '管理员',
      employee_id: 'ADMIN001',
      department_id: dept1.id,
      role: 'admin',
      password: 'admin123',
      status: 'active'
    })
    .select()
    .single();

  if (adminErr) {
    console.error('❌ 管理员添加失败:', adminErr);
    return;
  }
  console.log('✅ 管理员添加成功：ADMIN001 / admin123');

  // 3. 添加测试员工
  const { data: emp1, error: emp1Err } = await supabase
    .from('employees')
    .insert({
      name: '张三',
      employee_id: 'EMP001',
      department_id: dept1.id,
      role: 'employee',
      password: '123456',
      status: 'active'
    })
    .select()
    .single();

  const { data: emp2, error: emp2Err } = await supabase
    .from('employees')
    .insert({
      name: '李四',
      employee_id: 'EMP002',
      department_id: dept2.id,
      role: 'employee',
      password: '123456',
      status: 'active'
    })
    .select()
    .single();

  if (emp1Err || emp2Err) {
    console.error('❌ 员工添加失败:', emp1Err || emp2Err);
    return;
  }
  console.log('✅ 测试员工添加成功：');
  console.log('   - 张三 (EMP001) / 123456');
  console.log('   - 李四 (EMP002) / 123456');

  // 4. 添加考勤规则
  const { error: ruleErr } = await supabase
    .from('attendance_rules')
    .insert({
      work_start_time: '09:00',
      work_end_time: '18:00',
      late_threshold: 15,
      early_leave_threshold: 15
    });

  if (ruleErr) {
    console.error('❌ 考勤规则添加失败:', ruleErr);
    return;
  }
  console.log('✅ 考勤规则添加成功：09:00-18:00');

  console.log('\n🎉 测试数据添加完成！');
  console.log('\n📋 登录信息：');
  console.log('   管理员：ADMIN001 / admin123');
  console.log('   员工：EMP001 / 123456');
  console.log('             EMP002 / 123456');
}

seedData().catch(console.error);
