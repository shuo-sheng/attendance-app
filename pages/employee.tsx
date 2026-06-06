import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: number
  name: string
  employee_no: string
  department: string
  position: string
  role: string
}

interface AttendanceRecord {
  id: number
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  notes: string
}

interface LeaveRequest {
  id: number
  start_date: string
  end_date: string
  days: number
  type: string
  status: string
  reason: string
}

interface OvertimeRecord {
  id: number
  date: string
  hours: number
  status: string
  reason: string
}

interface MakeupRequest {
  id: number
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  reason: string
}

const LEAVE_TYPES: Record<string, string> = {
  annual: '年假', sick: '病假', personal: '事假', maternity: '产假', other: '其他'
}

const STATUS_LABELS: Record<string, string> = {
  normal: '正常', late: '迟到', early_leave: '早退', absent: '缺勤', leave: '请假', overtime: '加班'
}

const STATUS_CLASSES: Record<string, string> = {
  normal: 'status-badge approved',
  late: 'status-badge pending',
  early_leave: 'status-badge pending',
  absent: 'status-badge rejected',
  leave: 'status-badge approved',
  overtime: 'status-badge approved'
}

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const headerRow = headers.join(',')
  const dataRows = rows.map(r => headers.map(h => {
    const v = r[h]; return v != null ? `"${String(v).replace(/"/g, '""')}"` : ''
  }).join(','))
  const blob = new Blob(['\uFEFF' + headerRow + '\n' + dataRows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function EmployeePage() {
  const router = useRouter()
  const [user, setUser] = useState<Employee | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [overtimes, setOvertime] = useState<OvertimeRecord[]>([])
  const [makeups, setMakeups] = useState<MakeupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'attendance' | 'leave' | 'overtime' | 'makeup'>('dashboard')
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkOutLoading, setCheckOutLoading] = useState(false)

  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', type: 'annual', reason: '' })
  const [showOtForm, setShowOtForm] = useState(false)
  const [otForm, setOtForm] = useState({ date: '', hours: '', reason: '' })
  const [showMakeupForm, setShowMakeupForm] = useState(false)
  const [makeupForm, setMakeupForm] = useState({ date: '', check_in: '', check_out: '', reason: '' })

  useEffect(() => {
    const stored = localStorage.getItem('attendance_user')
    if (!stored) { router.push('/login'); return }
    const parsed = JSON.parse(stored)
    if (parsed.role === 'admin') { router.push('/'); return }
    setUser(parsed)
  }, [router])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [aRes, lRes, oRes, mRes] = await Promise.all([
        supabase.from('attendance_records').select('*').eq('employee_id', user.id).order('date', { ascending: false }),
        supabase.from('leave_requests').select('*').eq('employee_id', user.id).order('created_at', { ascending: false }),
        supabase.from('overtime_records').select('*').eq('employee_id', user.id).order('created_at', { ascending: false }),
        supabase.from('makeup_requests').select('*').eq('employee_id', user.id).order('created_at', { ascending: false })
      ])
      setAttendance(aRes.data || [])
      setLeaves(lRes.data || [])
      setOvertime(oRes.data || [])
      setMakeups(mRes.data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleCheckIn() {
    if (!user) return
    setCheckInLoading(true)
    const now = new Date().toTimeString().split(' ')[0]
    const today = new Date().toISOString().split('T')[0]
    const hour = new Date().getHours()
    const status = hour >= 9 ? 'late' : 'normal'
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('employee_id', user.id).eq('date', today).single()
    if (existing) {
      await supabase.from('attendance_records').update({ check_in: now, status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({ employee_id: user.id, date: today, check_in: now, status })
    }
    setCheckInLoading(false)
    loadData()
  }

  async function handleCheckOut() {
    if (!user) return
    setCheckOutLoading(true)
    const now = new Date().toTimeString().split(' ')[0]
    const today = new Date().toISOString().split('T')[0]
    const hour = new Date().getHours()
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('employee_id', user.id).eq('date', today).single()
    let status = existing?.status || 'normal'
    if (hour < 18 && status !== 'late') status = 'early_leave'
    if (existing) {
      await supabase.from('attendance_records').update({ check_out: now, status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({ employee_id: user.id, date: today, check_out: now, status: 'early_leave' })
    }
    setCheckOutLoading(false)
    loadData()
  }

  async function submitLeave() {
    if (!user || !leaveForm.start_date || !leaveForm.end_date) return
    const days = Math.floor((new Date(leaveForm.end_date).getTime() - new Date(leaveForm.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    await supabase.from('leave_requests').insert({ employee_id: user.id, ...leaveForm, days, status: 'pending' })
    setShowLeaveForm(false)
    setLeaveForm({ start_date: '', end_date: '', type: 'annual', reason: '' })
    loadData()
  }

  async function submitOvertime() {
    if (!user || !otForm.date || !otForm.hours) return
    await supabase.from('overtime_records').insert({ employee_id: user.id, date: otForm.date, hours: Number(otForm.hours), reason: otForm.reason, status: 'pending' })
    setShowOtForm(false)
    setOtForm({ date: '', hours: '', reason: '' })
    loadData()
  }

  async function submitMakeup() {
    if (!user || !makeupForm.date) return
    await supabase.from('makeup_requests').insert({ employee_id: user.id, ...makeupForm, status: 'pending' })
    setShowMakeupForm(false)
    setMakeupForm({ date: '', check_in: '', check_out: '', reason: '' })
    loadData()
  }

  function logout() { localStorage.removeItem('attendance_user'); router.push('/login') }

  function fmtTime(t: string | null | undefined) {
    if (!t) return '-'
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(t)) return t
    return new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  if (!user) return <div className="loading"><div className="spinner" /></div>

  const today = new Date().toISOString().split('T')[0]
  const todayRecord = attendance.find(a => a.date === today)
  const isCheckedIn = !!todayRecord?.check_in
  const isCheckedOut = !!todayRecord?.check_out

  const tabLabels: Record<string, string> = {
    dashboard: '工作台', attendance: '考勤记录', leave: '请假', overtime: '加班', makeup: '补卡'
  }

  return (
    <div className="app">
      <header className="header glass-panel">
        <div>
          <h1>欢迎，{user.name}</h1>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {user.department} · {user.position}
          </div>
        </div>
        <div className="header-actions">
          <span className="user-info">工号: {user.employee_no}</span>
          <button onClick={logout} className="btn-logout">退出</button>
        </div>
      </header>

      <div className="tabs">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`tab${tab === key ? ' active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Dashboard ─── */}
      {tab === 'dashboard' && (
        <>
          <div className="glass-panel" style={{ padding: 24, marginBottom: 14, textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
              今日打卡
            </h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCheckIn}
                disabled={isCheckedIn || checkInLoading}
                className={`check-btn in`}
                style={{
                  background: isCheckedIn ? '#dcfce7' : undefined,
                  color: isCheckedIn ? '#16a34a' : undefined,
                  boxShadow: isCheckedIn ? 'none' : undefined,
                }}
              >
                {isCheckedIn ? '已上班打卡' : checkInLoading ? '打卡中...' : '上班打卡'}
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!isCheckedIn || isCheckedOut || checkOutLoading}
                className={`check-btn out`}
                style={{
                  background: isCheckedOut ? '#dcfce7'
                    : !isCheckedIn ? 'rgba(0,0,0,0.04)' : undefined,
                  color: isCheckedOut ? '#16a34a'
                    : !isCheckedIn ? 'var(--text-muted)' : undefined,
                  boxShadow: isCheckedOut || !isCheckedIn ? 'none' : undefined,
                }}
              >
                {isCheckedOut ? '已下班打卡' : checkOutLoading ? '打卡中...' : '下班打卡'}
              </button>
            </div>
            {todayRecord && (
              <div className="check-info" style={{
                marginTop: 16, padding: '12px 16px',
                background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
              }}>
                上班: {todayRecord.check_in ? fmtTime(todayRecord.check_in) : '未打卡'}
                {' · '}
                下班: {todayRecord.check_out ? fmtTime(todayRecord.check_out) : '未打卡'}
                {' · '}
                状态: <span className={STATUS_CLASSES[todayRecord.status] || 'status-badge'}>
                  {STATUS_LABELS[todayRecord.status] || todayRecord.status}
                </span>
              </div>
            )}
          </div>

          <div className="stats-cards">
            {[
              { label: '本月出勤', value: attendance.filter(a => a.status === 'normal' && a.date.startsWith(today.slice(0, 7))).length },
              { label: '本月迟到', value: attendance.filter(a => a.status === 'late' && a.date.startsWith(today.slice(0, 7))).length },
              { label: '请假天数', value: leaves.filter(l => l.status === 'approved').reduce((s, l) => s + (l.days || 0), 0) },
              { label: '加班时长(h)', value: overtimes.filter(o => o.status === 'approved').reduce((s, o) => s + (o.hours || 0), 0) },
            ].map(stat => (
              <div key={stat.label} className="stat-card">
                <div className="stat-number">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>最近考勤</h3>
            {attendance.slice(0, 5).map(record => (
              <div key={record.id} className="list-item">
                <span>{record.date}</span>
                <span className={STATUS_CLASSES[record.status] || 'status-badge'}>
                  {STATUS_LABELS[record.status] || record.status}
                </span>
              </div>
            ))}
            {attendance.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>暂无记录</p>}
          </div>
        </>
      )}

      {/* ─── Attendance ─── */}
      {tab === 'attendance' && (
        <div className="glass-panel panel">
          <div className="panel-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>考勤记录</h3>
            <button className="btn-secondary" onClick={() => downloadCSV(
              attendance.map(a => ({ 日期: a.date, 上班: fmtTime(a.check_in), 下班: fmtTime(a.check_out), 状态: STATUS_LABELS[a.status] || a.status, 备注: a.notes || '' })),
              `考勤记录_${user.name}_${today}.csv`
            )}>导出CSV</button>
          </div>
          <div className="data-table">
            <table>
              <thead>
                <tr><th>日期</th><th>上班</th><th>下班</th><th>状态</th></tr>
              </thead>
              <tbody>
                {attendance.map(record => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>{record.check_in ? fmtTime(record.check_in) : '-'}</td>
                    <td>{record.check_out ? fmtTime(record.check_out) : '-'}</td>
                    <td><span className={STATUS_CLASSES[record.status] || 'status-badge'}>{STATUS_LABELS[record.status] || record.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendance.length === 0 && <div className="empty">暂无记录</div>}
          </div>
        </div>
      )}

      {/* ─── Leave ─── */}
      {tab === 'leave' && (
        <div className="glass-panel panel">
          <div className="panel-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>请假申请</h3>
            <button className="btn-secondary" onClick={() => downloadCSV(
              leaves.map(l => ({ 类型: LEAVE_TYPES[l.type] || l.type, 开始: l.start_date, 结束: l.end_date, 天数: l.days, 状态: l.status === 'approved' ? '已通过' : l.status === 'rejected' ? '已拒绝' : '审批中', 原因: l.reason || '' })),
              `请假记录_${user.name}_${today}.csv`
            )}>导出CSV</button>
            <button onClick={() => setShowLeaveForm(true)} className="btn-primary">申请请假</button>
          </div>

          {showLeaveForm && (
            <div className="inline-form">
              <div className="form-row">
                <div className="form-field">
                  <label>开始日期</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>结束日期</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} />
                </div>
              </div>
              <div className="form-field">
                <label>请假类型</label>
                <select value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}>
                  {Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>原因</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} rows={2} />
              </div>
              <div className="form-actions">
                <button onClick={submitLeave} className="btn-primary">提交</button>
                <button onClick={() => setShowLeaveForm(false)} className="btn-secondary">取消</button>
              </div>
            </div>
          )}

          {leaves.map(leave => (
            <div key={leave.id} className="list-item">
              <div className="list-item-body">
                <div className="list-item-title">{LEAVE_TYPES[leave.type] || leave.type}</div>
                <div className="list-item-meta">{leave.start_date} 至 {leave.end_date} · {leave.days}天</div>
                {leave.reason && <div className="list-item-meta2">{leave.reason}</div>}
              </div>
              <span className={`status-badge ${leave.status === 'approved' ? 'approved' : leave.status === 'rejected' ? 'rejected' : 'pending'}`}>
                {leave.status === 'approved' ? '已通过' : leave.status === 'rejected' ? '已拒绝' : '审批中'}
              </span>
            </div>
          ))}
          {leaves.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>暂无请假记录</p>}
        </div>
      )}

      {/* ─── Overtime ─── */}
      {tab === 'overtime' && (
        <div className="glass-panel panel">
          <div className="panel-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>加班申请</h3>
            <button className="btn-secondary" onClick={() => downloadCSV(
              overtimes.map(o => ({ 日期: o.date, 时长: o.hours + 'h', 状态: o.status === 'approved' ? '已通过' : o.status === 'rejected' ? '已拒绝' : '审批中', 原因: o.reason || '' })),
              `加班记录_${user.name}_${today}.csv`
            )}>导出CSV</button>
            <button onClick={() => setShowOtForm(true)} className="btn-primary">申请加班</button>
          </div>

          {showOtForm && (
            <div className="inline-form">
              <div className="form-row">
                <div className="form-field">
                  <label>日期</label>
                  <input type="date" value={otForm.date} onChange={e => setOtForm({...otForm, date: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>时长（小时）</label>
                  <input type="number" step="0.5" value={otForm.hours} onChange={e => setOtForm({...otForm, hours: e.target.value})} />
                </div>
              </div>
              <div className="form-field">
                <label>原因</label>
                <textarea value={otForm.reason} onChange={e => setOtForm({...otForm, reason: e.target.value})} rows={2} />
              </div>
              <div className="form-actions">
                <button onClick={submitOvertime} className="btn-primary">提交</button>
                <button onClick={() => setShowOtForm(false)} className="btn-secondary">取消</button>
              </div>
            </div>
          )}

          {overtimes.map(ot => (
            <div key={ot.id} className="list-item">
              <div className="list-item-body">
                <div className="list-item-title">{ot.date} · {ot.hours}小时</div>
                {ot.reason && <div className="list-item-meta2">{ot.reason}</div>}
              </div>
              <span className={`status-badge ${ot.status === 'approved' ? 'approved' : ot.status === 'rejected' ? 'rejected' : 'pending'}`}>
                {ot.status === 'approved' ? '已通过' : ot.status === 'rejected' ? '已拒绝' : '审批中'}
              </span>
            </div>
          ))}
          {overtimes.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>暂无加班记录</p>}
        </div>
      )}

      {/* ─── Makeup ─── */}
      {tab === 'makeup' && (
        <div className="glass-panel panel">
          <div className="panel-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>补卡申请</h3>
            <button className="btn-secondary" onClick={() => downloadCSV(
              makeups.map(m => ({ 日期: m.date, 上班: m.check_in || '未填', 下班: m.check_out || '未填', 状态: m.status === 'approved' ? '已通过' : m.status === 'rejected' ? '已拒绝' : '审批中', 原因: m.reason || '' })),
              `补卡记录_${user.name}_${today}.csv`
            )}>导出CSV</button>
            <button onClick={() => setShowMakeupForm(true)} className="btn-primary">申请补卡</button>
          </div>

          {showMakeupForm && (
            <div className="inline-form">
              <div className="form-field">
                <label>补卡日期</label>
                <input type="date" value={makeupForm.date} onChange={e => setMakeupForm({...makeupForm, date: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>上班时间</label>
                  <input type="time" value={makeupForm.check_in} onChange={e => setMakeupForm({...makeupForm, check_in: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>下班时间</label>
                  <input type="time" value={makeupForm.check_out} onChange={e => setMakeupForm({...makeupForm, check_out: e.target.value})} />
                </div>
              </div>
              <div className="form-field">
                <label>补卡原因</label>
                <textarea value={makeupForm.reason} onChange={e => setMakeupForm({...makeupForm, reason: e.target.value})} rows={2} />
              </div>
              <div className="form-actions">
                <button onClick={submitMakeup} className="btn-primary">提交</button>
                <button onClick={() => setShowMakeupForm(false)} className="btn-secondary">取消</button>
              </div>
            </div>
          )}

          {makeups.map(makeup => (
            <div key={makeup.id} className="list-item">
              <div className="list-item-body">
                <div className="list-item-title">{makeup.date}</div>
                <div className="list-item-meta">上班: {makeup.check_in || '未填'} · 下班: {makeup.check_out || '未填'}</div>
                {makeup.reason && <div className="list-item-meta2">{makeup.reason}</div>}
              </div>
              <span className={`status-badge ${makeup.status === 'approved' ? 'approved' : makeup.status === 'rejected' ? 'rejected' : 'pending'}`}>
                {makeup.status === 'approved' ? '已通过' : makeup.status === 'rejected' ? '已拒绝' : '审批中'}
              </span>
            </div>
          ))}
          {makeups.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>暂无补卡记录</p>}
        </div>
      )}
    </div>
  )
}
