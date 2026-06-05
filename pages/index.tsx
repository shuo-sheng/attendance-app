import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

// ─── Types ───
interface Employee {
  id: number
  name: string
  department: string
  position: string
  email: string
  created_at: string
}

interface AttendanceRecord {
  id: number
  employee_id: number
  date: string
  check_in: string | null
  check_out: string | null
  status: 'normal' | 'late' | 'early_leave' | 'absent' | 'leave' | 'overtime'
  notes: string
  created_at: string
  employee?: Employee
}

interface LeaveRequest {
  id: number
  employee_id: number
  start_date: string
  end_date: string
  type: 'annual' | 'sick' | 'personal' | 'maternity' | 'other'
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  employee?: Employee
}

interface OvertimeRecord {
  id: number
  employee_id: number
  date: string
  hours: number
  status: 'pending' | 'approved' | 'rejected'
  notes: string
  created_at: string
  employee?: Employee
}

interface MakeupRequest {
  id: number
  employee_id: number
  date: string
  check_in: string | null
  check_out: string | null
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  employee?: Employee
}

// ─── Constants ───
const DEPARTMENTS = ['技术部', '产品部', '设计部', '运营部', '市场部', '人事部', '财务部']
const LEAVE_TYPES: Record<string, string> = {
  annual: '年假', sick: '病假', personal: '事假', maternity: '产假', other: '其他'
}
const STATUS_LABELS: Record<string, string> = {
  normal: '正常', late: '迟到', early_leave: '早退', absent: '缺勤', leave: '请假', overtime: '加班'
}
const STATUS_COLORS: Record<string, string> = {
  normal: '#52c41a', late: '#faad14', early_leave: '#fa8c16', absent: '#ff4d4f', leave: '#1890ff', overtime: '#722ed1'
}

// ─── Helpers ───
function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${m}/${day}`
}
function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
}

// ─── Auth Guard ───
function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('attendance_user')
    if (!stored) {
      router.push('/login')
      return
    }
    const parsed = JSON.parse(stored)
    if (parsed.role !== 'admin') {
      router.push('/employee')
      return
    }
    setUser(parsed)
    setAuthLoading(false)
  }, [router])

  return { user, authLoading }
}

// ─── Main Component ───
export default function AdminDashboard() {
  const { user, authLoading } = useAuth()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([])
  const [makeups, setMakeups] = useState<MakeupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'employees' | 'attendance' | 'calendar' | 'leave' | 'overtime' | 'makeup' | 'stats'>('employees')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('全部')

//  Employee form
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [empForm, setEmpForm] = useState({ name: '', department: '技术部', position: '', email: '' })

//  Attendance check-in
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [selectedEmpForCheck, setSelectedEmpForCheck] = useState<number | null>(null)
  const [checkNote, setCheckNote] = useState('')

//  Leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '', start_date: '', end_date: '', type: 'annual' as const, reason: ''
  })

//  Overtime form
  const [showOtForm, setShowOtForm] = useState(false)
  const [otForm, setOtForm] = useState({
    employee_id: '', date: '', hours: '', notes: ''
  })

  const [showMakeupForm, setShowMakeupForm] = useState(false)
  const [makeupForm, setMakeupForm] = useState({
    employee_id: '', date: '', check_in: '', check_out: '', reason: ''
  })

//  Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

//  ─── Data Loading ───
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, aRes, lRes, oRes, mRes] = await Promise.all([
        supabase.from('employees').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance_records').select('*, employee:employees(*)').order('date', { ascending: false }),
        supabase.from('leave_requests').select('*, employee:employees(*)').order('created_at', { ascending: false }),
        supabase.from('overtime_records').select('*, employee:employees(*)').order('created_at', { ascending: false }),
        supabase.from('makeup_requests').select('*, employee:employees(*)').order('created_at', { ascending: false })
      ])
      if (eRes.error) throw eRes.error
      if (aRes.error) throw aRes.error
      if (lRes.error) throw lRes.error
      if (oRes.error) throw oRes.error
      if (mRes.error) throw mRes.error
      setEmployees(eRes.data || [])
      setAttendance(aRes.data || [])
      setLeaves(lRes.data || [])
      setOvertimes(oRes.data || [])
      setMakeups(mRes.data || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

//  ─── Employee CRUD ───
  async function saveEmployee() {
    if (!empForm.name.trim() || !empForm.position.trim()) return
    const payload = { ...empForm }
    if (editingEmp) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editingEmp.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('employees').insert(payload)
      if (error) { setError(error.message); return }
    }
    setShowEmpForm(false)
    setEditingEmp(null)
    setEmpForm({ name: '', department: '技术部', position: '', email: '' })
    loadAll()
  }

  async function deleteEmployee(id: number) {
    if (!confirm('确定删除该员工？相关考勤/请假/加班记录也会被删除。')) return
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  function editEmployee(emp: Employee) {
    setEditingEmp(emp)
    setEmpForm({ name: emp.name, department: emp.department, position: emp.position, email: emp.email || '' })
    setShowEmpForm(true)
  }

//  ─── Attendance Check-in/Out ───
  async function checkIn(empId: number) {
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', empId)
      .eq('date', selectedDate)
      .single()

    const now = new Date().toISOString()
    const hour = new Date().getHours()
    const status = hour >= 9 ? 'late' : 'normal'

    if (existing) {
      const { error } = await supabase.from('attendance_records').update({
        check_in: now, status: existing.check_out ? existing.status : status, notes: checkNote || existing.notes
      }).eq('id', existing.id)
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.from('attendance_records').insert({
        employee_id: empId, date: selectedDate, check_in: now, status, notes: checkNote
      })
      if (error) setError(error.message)
    }
    setCheckNote('')
    loadAll()
  }

  async function checkOut(empId: number) {
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', empId)
      .eq('date', selectedDate)
      .single()

    const now = new Date().toISOString()
    const hour = new Date().getHours()
    let status = existing?.status || 'normal'
    if (hour < 18 && status !== 'late') status = 'early_leave'

    if (existing) {
      const { error } = await supabase.from('attendance_records').update({
        check_out: now, status, notes: checkNote || existing.notes
      }).eq('id', existing.id)
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.from('attendance_records').insert({
        employee_id: empId, date: selectedDate, check_out: now, status: 'early_leave', notes: checkNote
      })
      if (error) setError(error.message)
    }
    setCheckNote('')
    loadAll()
  }

  async function markAbsent(empId: number) {
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', empId)
      .eq('date', selectedDate)
      .single()

    if (existing) {
      const { error } = await supabase.from('attendance_records').update({ status: 'absent' }).eq('id', existing.id)
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.from('attendance_records').insert({
        employee_id: empId, date: selectedDate, status: 'absent', notes: checkNote
      })
      if (error) setError(error.message)
    }
    loadAll()
  }

//  ─── Leave CRUD ───
  async function saveLeave() {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) return
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: Number(leaveForm.employee_id),
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      type: leaveForm.type,
      reason: leaveForm.reason
    })
    if (error) { setError(error.message); return }
    setShowLeaveForm(false)
    setLeaveForm({ employee_id: '', start_date: '', end_date: '', type: 'annual', reason: '' })
    loadAll()
  }

  async function updateLeaveStatus(id: number, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  async function deleteLeave(id: number) {
    if (!confirm('确定删除这条请假记录？')) return
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

//  ─── Overtime CRUD ───
  async function saveOvertime() {
    if (!otForm.employee_id || !otForm.date || !otForm.hours) return
    const { error } = await supabase.from('overtime_records').insert({
      employee_id: Number(otForm.employee_id),
      date: otForm.date,
      hours: Number(otForm.hours),
      notes: otForm.notes, reason: otForm.notes
    })
    if (error) { setError(error.message); return }
    setShowOtForm(false)
    setOtForm({ employee_id: '', date: '', hours: '', notes: '' })
    loadAll()
  }

  async function updateOtStatus(id: number, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('overtime_records').update({ status }).eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  async function deleteOvertime(id: number) {
    if (!confirm('确定删除这条加班记录？')) return
    const { error } = await supabase.from('overtime_records').delete().eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

//  ─── Makeup CRUD ───
  async function saveMakeup() {
    if (!makeupForm.employee_id || !makeupForm.date) return
    const { error } = await supabase.from('makeup_requests').insert({
      employee_id: Number(makeupForm.employee_id),
      date: makeupForm.date,
      check_in: makeupForm.check_in || null,
      check_out: makeupForm.check_out || null,
      reason: makeupForm.reason,
      status: 'pending'
    })
    if (error) { setError(error.message); return }
    setShowMakeupForm(false)
    setMakeupForm({ employee_id: '', date: '', check_in: '', check_out: '', reason: '' })
    loadAll()
  }

  async function updateMakeupStatus(id: number, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('makeup_requests').update({ status }).eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  async function deleteMakeup(id: number) {
    if (!confirm('确定删除这条补卡记录？')) return
    const { error } = await supabase.from('makeup_requests').delete().eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  function logout() {
    localStorage.removeItem('attendance_user')
    router.push('/login')
  }

  if (authLoading) return <div className="p-8">验证中...</div>
  if (!user) return null

//  ─── Filters ───
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = !search || e.name.includes(search) || e.position.includes(search) || e.email?.includes(search)
      const matchDept = deptFilter === '全部' || e.department === deptFilter
      return matchSearch && matchDept
    })
  }, [employees, search, deptFilter])

//  ─── Stats ───
  const stats = useMemo(() => {
    const totalEmp = employees.length
    const todayAttendance = attendance.filter(a => a.date === selectedDate)
    const checkedIn = todayAttendance.filter(a => a.check_in).length
    const checkedOut = todayAttendance.filter(a => a.check_out).length
    const lateCount = attendance.filter(a => a.status === 'late').length
    const earlyCount = attendance.filter(a => a.status === 'early_leave').length
    const absentCount = attendance.filter(a => a.status === 'absent').length
    const leaveCount = attendance.filter(a => a.status === 'leave').length
    const totalRecords = attendance.length || 1
    const attendanceRate = Math.round(((totalRecords - absentCount - leaveCount) / totalRecords) * 100)

    // Dept stats
    const deptStats: Record<string, { total: number; present: number; absent: number }> = {}
    employees.forEach(e => {
      deptStats[e.department] = deptStats[e.department] || { total: 0, present: 0, absent: 0 }
    })
    todayAttendance.forEach(a => {
      const emp = employees.find(e => e.id === a.employee_id)
      if (!emp) return
      const d = deptStats[emp.department]
      d.total++
      if (a.status === 'absent' || a.status === 'leave') d.absent++
      else d.present++
    })

    // Recent 7 days trend
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const dayRecs = attendance.filter(a => a.date === ds)
      trend.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        present: dayRecs.filter(a => a.status !== 'absent' && a.status !== 'leave').length,
        absent: dayRecs.filter(a => a.status === 'absent').length,
        late: dayRecs.filter(a => a.status === 'late').length
      })
    }

    return {
      totalEmp, checkedIn, checkedOut, attendanceRate,
      lateCount, earlyCount, absentCount, leaveCount,
      deptStats, trend
    }
  }, [employees, attendance, selectedDate])

//  ─── Calendar ───
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1)
    const last = new Date(calYear, calMonth + 1, 0)
    const startDay = first.getDay()
    const daysInMonth = last.getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [calYear, calMonth])

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>()
    attendance.forEach(a => {
      if (!map.has(a.date)) map.set(a.date, [])
      map.get(a.date)!.push(a)
    })
    return map
  }, [attendance])

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

//  ─── Render ───
  return (
    <div className="app">
      <div className="header glass-panel">
        <h1>📋 考勤管理系统</h1>
        <div className="header-actions">
          {user && (
            <span className="user-info">
              👤 {user.name} ({user.employee_no}) · 
              <button className="btn-logout" onClick={logout}>退出</button>
            </span>
          )}
          <button className="btn-refresh" onClick={loadAll} disabled={loading}>
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="tabs">
        {([
          { key: 'employees', label: '👥 员工管理' },
          { key: 'attendance', label: '⏰ 每日考勤' },
          { key: 'calendar', label: '📅 考勤日历' },
          { key: 'leave', label: '📝 请假管理' },
          { key: 'overtime', label: '⏱️ 加班记录' },
          { key: 'makeup', label: '🔄 补卡管理' },
          { key: 'stats', label: '📊 统计报表' },
        ] as const).map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Employees Tab ─── */}
      {tab === 'employees' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <input
              className="search-input"
              placeholder="🔍 搜索员工姓名、职位、邮箱..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="select">
              <option value="全部">全部部门</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button className="btn-primary" onClick={() => { setEditingEmp(null); setEmpForm({ name: '', department: '技术部', position: '', email: '' }); setShowEmpForm(true) }}>
              + 添加员工
            </button>
          </div>

          {showEmpForm && (
            <div className="modal-overlay" onClick={() => setShowEmpForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>{editingEmp ? '编辑员工' : '添加员工'}</h3>
                <input placeholder="姓名" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} />
                <select value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input placeholder="职位" value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} />
                <input placeholder="邮箱（可选）" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowEmpForm(false)}>取消</button>
                  <button className="btn-primary" onClick={saveEmployee}>保存</button>
                </div>
              </div>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>姓名</th><th>部门</th><th>职位</th><th>邮箱</th><th>入职时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id}>
                    <td><strong>{emp.name}</strong></td>
                    <td><span className="tag">{emp.department}</span></td>
                    <td>{emp.position}</td>
                    <td>{emp.email || '-'}</td>
                    <td>{formatDate(emp.created_at?.split('T')[0])}</td>
                    <td>
                      <button className="btn-icon" onClick={() => editEmployee(emp)} title="编辑">✏️</button>
                      <button className="btn-icon" onClick={() => deleteEmployee(emp.id)} title="删除">🗑️</button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr><td colSpan={6} className="empty">暂无员工，请添加</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Attendance Tab ─── */}
      {tab === 'attendance' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="date-input" />
            <span className="toolbar-info">共 {employees.length} 人</span>
          </div>

          <div className="checkin-grid">
            {employees.map(emp => {
              const rec = attendance.find(a => a.employee_id === emp.id && a.date === selectedDate)
              return (
                <div key={emp.id} className={`checkin-card ${rec?.status || 'normal'}`}>
                  <div className="checkin-header">
                    <strong>{emp.name}</strong>
                    <span className="tag">{emp.department}</span>
                  </div>
                  <div className="checkin-status">
                    {rec ? (
                      <>
                        <span className="status-badge" style={{ background: STATUS_COLORS[rec.status] + '20', color: STATUS_COLORS[rec.status] }}>
                          {STATUS_LABELS[rec.status]}
                        </span>
                        <div className="checkin-times">
                          {rec.check_in && <span>🌅 签到 {new Date(`${rec.date}T${rec.check_in}`).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {rec.check_out && <span>🌙 签退 {new Date(`${rec.date}T${rec.check_out}`).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      </>
                    ) : (
                      <span className="status-badge" style={{ background: '#f0f0f0', color: '#999' }}>未打卡</span>
                    )}
                  </div>
                  <div className="checkin-actions">
                    <button className="btn-small" onClick={() => checkIn(emp.id)} disabled={!!rec?.check_in}>
                      {rec?.check_in ? '已签到' : '签到'}
                    </button>
                    <button className="btn-small" onClick={() => checkOut(emp.id)} disabled={!rec?.check_in || !!rec?.check_out}>
                      {rec?.check_out ? '已签退' : '签退'}
                    </button>
                    <button className="btn-small btn-danger" onClick={() => markAbsent(emp.id)}>缺勤</button>
                  </div>
                  {rec?.notes && <p className="checkin-note">📝 {rec.notes}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Calendar Tab ─── */}
      {tab === 'calendar' && (
        <div className="panel glass-panel">
          <div className="calendar-header">
            <button className="cal-nav" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}>◀</button>
            <span className="cal-title">{calYear}年 {calMonth + 1}月</span>
            <button className="cal-nav" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}>▶</button>
          </div>
          <div className="calendar-grid">
            {weekDays.map(d => <div key={d} className="cal-weekday">{d}</div>)}
            {calDays.map((day, idx) => {
              if (day === null) return <div key={`e${idx}`} className="cal-day empty" />
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayRecs = attendanceByDate.get(ds) || []
              const isToday = ds === todayStr()
              const isSelected = ds === selectedDate
              return (
                <div
                  key={ds}
                  className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => { setSelectedDate(ds); setTab('attendance') }}
                >
                  <span className="day-number">{day}</span>
                  {dayRecs.length > 0 && (
                    <div className="day-badges">
                      {dayRecs.some(r => r.status === 'absent') && <span className="day-dot absent" />}
                      {dayRecs.some(r => r.status === 'late') && <span className="day-dot late" />}
                      {dayRecs.some(r => r.status === 'early_leave') && <span className="day-dot early" />}
                      {dayRecs.some(r => r.status === 'normal' || r.status === 'overtime') && <span className="day-dot normal" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="calendar-legend">
            <span><span className="day-dot normal" />正常</span>
            <span><span className="day-dot late" />迟到</span>
            <span><span className="day-dot early" />早退</span>
            <span><span className="day-dot absent" />缺勤</span>
          </div>
        </div>
      )}

      {/* ─── Leave Tab ─── */}
      {tab === 'leave' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <button className="btn-primary" onClick={() => setShowLeaveForm(true)}>+ 申请请假</button>
          </div>

          {showLeaveForm && (
            <div className="modal-overlay" onClick={() => setShowLeaveForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>申请请假</h3>
                <select value={leaveForm.employee_id} onChange={e => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}>
                  <option value="">选择员工</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
                <label>开始日期</label>
                <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
                <label>结束日期</label>
                <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
                <select value={leaveForm.type} onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value as any })}>
                  {Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <textarea placeholder="请假原因" rows={3} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowLeaveForm(false)}>取消</button>
                  <button className="btn-primary" onClick={saveLeave}>提交</button>
                </div>
              </div>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead>
                <tr><th>员工</th><th>部门</th><th>类型</th><th>起止日期</th><th>天数</th><th>原因</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employee?.name}</strong></td>
                    <td><span className="tag">{l.employee?.department}</span></td>
                    <td>{LEAVE_TYPES[l.type]}</td>
                    <td>{formatDate(l.start_date)} - {formatDate(l.end_date)}</td>
                    <td>{daysBetween(l.start_date, l.end_date)} 天</td>
                    <td className="cell-truncate" title={l.reason}>{l.reason || '-'}</td>
                    <td>
                      <span className={`status-badge ${l.status}`}>
                        {l.status === 'pending' ? '⏳ 待审批' : l.status === 'approved' ? '✅ 已批准' : '❌ 已拒绝'}
                      </span>
                    </td>
                    <td>
                      {l.status === 'pending' && (
                        <>
                          <button className="btn-icon" onClick={() => updateLeaveStatus(l.id, 'approved')} title="批准">✅</button>
                          <button className="btn-icon" onClick={() => updateLeaveStatus(l.id, 'rejected')} title="拒绝">❌</button>
                        </>
                      )}
                      <button className="btn-icon" onClick={() => deleteLeave(l.id)} title="删除">🗑️</button>
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && <tr><td colSpan={8} className="empty">暂无请假记录</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Overtime Tab ─── */}
      {tab === 'overtime' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <button className="btn-primary" onClick={() => setShowOtForm(true)}>+ 申请加班</button>
          </div>

          {showOtForm && (
            <div className="modal-overlay" onClick={() => setShowOtForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>申请加班</h3>
                <select value={otForm.employee_id} onChange={e => setOtForm({ ...otForm, employee_id: e.target.value })}>
                  <option value="">选择员工</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
                <label>加班日期</label>
                <input type="date" value={otForm.date} onChange={e => setOtForm({ ...otForm, date: e.target.value })} />
                <label>加班时长（小时）</label>
                <input type="number" step="0.5" min="0.5" placeholder="2.5" value={otForm.hours} onChange={e => setOtForm({ ...otForm, hours: e.target.value })} />
                <textarea placeholder="备注" rows={2} value={otForm.notes} onChange={e => setOtForm({ ...otForm, notes: e.target.value })} />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowOtForm(false)}>取消</button>
                  <button className="btn-primary" onClick={saveOvertime}>提交</button>
                </div>
              </div>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead>
                <tr><th>员工</th><th>部门</th><th>日期</th><th>时长</th><th>备注</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {overtimes.map(o => (
                  <tr key={o.id}>
                    <td><strong>{o.employee?.name}</strong></td>
                    <td><span className="tag">{o.employee?.department}</span></td>
                    <td>{formatDate(o.date)}</td>
                    <td><strong>{o.hours} 小时</strong></td>
                    <td className="cell-truncate" title={o.notes || o.reason}>{o.notes || o.reason || '-'}</td>
                    <td>
                      <span className={`status-badge ${o.status}`}>
                        {o.status === 'pending' ? '⏳ 待审批' : o.status === 'approved' ? '✅ 已批准' : '❌ 已拒绝'}
                      </span>
                    </td>
                    <td>
                      {o.status === 'pending' && (
                        <>
                          <button className="btn-icon" onClick={() => updateOtStatus(o.id, 'approved')} title="批准">✅</button>
                          <button className="btn-icon" onClick={() => updateOtStatus(o.id, 'rejected')} title="拒绝">❌</button>
                        </>
                      )}
                      <button className="btn-icon" onClick={() => deleteOvertime(o.id)} title="删除">🗑️</button>
                    </td>
                  </tr>
                ))}
                {overtimes.length === 0 && <tr><td colSpan={7} className="empty">暂无加班记录</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Makeup Tab ─── */}
      {tab === 'makeup' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <button className="btn-primary" onClick={() => setShowMakeupForm(true)}>+ 申请补卡</button>
          </div>

          {showMakeupForm && (
            <div className="modal-overlay" onClick={() => setShowMakeupForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>申请补卡</h3>
                <select value={makeupForm.employee_id} onChange={e => setMakeupForm({ ...makeupForm, employee_id: e.target.value })}>
                  <option value="">选择员工</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
                <label>补卡日期</label>
                <input type="date" value={makeupForm.date} onChange={e => setMakeupForm({ ...makeupForm, date: e.target.value })} />
                <label>上班时间</label>
                <input type="time" value={makeupForm.check_in} onChange={e => setMakeupForm({ ...makeupForm, check_in: e.target.value })} />
                <label>下班时间</label>
                <input type="time" value={makeupForm.check_out} onChange={e => setMakeupForm({ ...makeupForm, check_out: e.target.value })} />
                <textarea placeholder="补卡原因" rows={2} value={makeupForm.reason} onChange={e => setMakeupForm({ ...makeupForm, reason: e.target.value })} />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowMakeupForm(false)}>取消</button>
                  <button className="btn-primary" onClick={saveMakeup}>提交</button>
                </div>
              </div>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead>
                <tr><th>员工</th><th>部门</th><th>日期</th><th>上班时间</th><th>下班时间</th><th>原因</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {makeups.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.employee?.name}</strong></td>
                    <td><span className="tag">{m.employee?.department}</span></td>
                    <td>{formatDate(m.date)}</td>
                    <td>{m.check_in || '-'}</td>
                    <td>{m.check_out || '-'}</td>
                    <td className="cell-truncate" title={m.reason}>{m.reason || '-'}</td>
                    <td>
                      <span className={`status-badge ${m.status}`}>
                        {m.status === 'pending' ? '⏳ 待审批' : m.status === 'approved' ? '✅ 已批准' : '❌ 已拒绝'}
                      </span>
                    </td>
                    <td>
                      {m.status === 'pending' && (
                        <>
                          <button className="btn-icon" onClick={() => updateMakeupStatus(m.id, 'approved')} title="批准">✅</button>
                          <button className="btn-icon" onClick={() => updateMakeupStatus(m.id, 'rejected')} title="拒绝">❌</button>
                        </>
                      )}
                      <button className="btn-icon" onClick={() => deleteMakeup(m.id)} title="删除">🗑️</button>
                    </td>
                  </tr>
                ))}
                {makeups.length === 0 && <tr><td colSpan={8} className="empty">暂无补卡记录</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Stats Tab ─── */}
      {tab === 'stats' && (
        <div className="panel glass-panel">
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-number">{stats.totalEmp}</div>
              <div className="stat-label">总员工</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: '#52c41a' }}>{stats.attendanceRate}%</div>
              <div className="stat-label">出勤率</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: '#faad14' }}>{stats.lateCount}</div>
              <div className="stat-label">迟到</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: '#fa8c16' }}>{stats.earlyCount}</div>
              <div className="stat-label">早退</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: '#ff4d4f' }}>{stats.absentCount}</div>
              <div className="stat-label">缺勤</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: '#1890ff' }}>{stats.leaveCount}</div>
              <div className="stat-label">请假</div>
            </div>
          </div>

          <div className="stats-section">
            <h3>📅 今日考勤 ({formatDate(selectedDate)})</h3>
            <div className="stats-row">
              <span>签到: {stats.checkedIn}/{stats.totalEmp}</span>
              <span>签退: {stats.checkedOut}/{stats.totalEmp}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${stats.totalEmp ? (stats.checkedIn / stats.totalEmp) * 100 : 0}%`, background: '#52c41a' }} />
            </div>
          </div>

          <div className="stats-section">
            <h3>🏢 部门出勤</h3>
            {Object.entries(stats.deptStats).map(([dept, d]) => (
              <div key={dept} className="stats-row">
                <span>{dept}</span>
                <span>出勤 {d.present} / 缺勤 {d.absent}</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${d.total ? (d.present / d.total) * 100 : 0}%`, background: '#1890ff' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="stats-section">
            <h3>📈 近7天趋势</h3>
            <div className="trend-chart">
              <svg viewBox={`0 0 ${stats.trend.length * 60} 140`} className="trend-svg">
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={i} x1="0" y1={120 - r * 100} x2={stats.trend.length * 60} y2={120 - r * 100} stroke="#eee" strokeWidth="0.5" />
                ))}
                <polyline fill="none" stroke="#52c41a" strokeWidth="2" points={stats.trend.map((d, i) => `${i * 60 + 30},${120 - (d.present / Math.max(...stats.trend.map(t => t.present), 1)) * 100}`).join(' ')} />
                <polyline fill="none" stroke="#ff4d4f" strokeWidth="2" strokeDasharray="4,2" points={stats.trend.map((d, i) => `${i * 60 + 30},${120 - (d.absent / Math.max(...stats.trend.map(t => t.absent), 1)) * 100}`).join(' ')} />
                <polyline fill="none" stroke="#faad14" strokeWidth="2" strokeDasharray="2,2" points={stats.trend.map((d, i) => `${i * 60 + 30},${120 - (d.late / Math.max(...stats.trend.map(t => t.late), 1)) * 100}`).join(' ')} />
                {stats.trend.map((d, i) => (
                  <g key={i}>
                    <circle cx={i * 60 + 30} cy={120 - (d.present / Math.max(...stats.trend.map(t => t.present), 1)) * 100} r="3" fill="#52c41a" />
                    <text x={i * 60 + 30} y="135" textAnchor="middle" fontSize="8" fill="#999">{d.date}</text>
                  </g>
                ))}
              </svg>
              <div className="trend-legend">
                <span><span className="dot" style={{ background: '#52c41a' }} />出勤</span>
                <span><span className="dot" style={{ background: '#ff4d4f' }} />缺勤</span>
                <span><span className="dot" style={{ background: '#faad14' }} />迟到</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
