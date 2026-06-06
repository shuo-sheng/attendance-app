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

const STATUS_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-800',
  late: 'bg-yellow-100 text-yellow-800',
  early_leave: 'bg-orange-100 text-orange-800',
  absent: 'bg-red-100 text-red-800',
  leave: 'bg-blue-100 text-blue-800',
  overtime: 'bg-purple-100 text-purple-800'
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

  // Forms
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', type: 'annual', reason: '' })
  
  const [showOtForm, setShowOtForm] = useState(false)
  const [otForm, setOtForm] = useState({ date: '', hours: '', reason: '' })
  
  const [showMakeupForm, setShowMakeupForm] = useState(false)
  const [makeupForm, setMakeupForm] = useState({ date: '', check_in: '', check_out: '', reason: '' })

  useEffect(() => {
    const stored = localStorage.getItem('attendance_user')
    if (!stored) {
      router.push('/login')
      return
    }
    const parsed = JSON.parse(stored)
    if (parsed.role === 'admin') {
      router.push('/')
      return
    }
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
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function handleCheckIn() {
    if (!user) return
    setCheckInLoading(true)
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]
    const hour = new Date().getHours()
    const status = hour >= 9 ? 'late' : 'normal'

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .eq('date', today)
      .single()

    if (existing) {
      await supabase.from('attendance_records').update({ check_in: now, status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({
        employee_id: user.id, date: today, check_in: now, status
      })
    }
    setCheckInLoading(false)
    loadData()
  }

  async function handleCheckOut() {
    if (!user) return
    setCheckOutLoading(true)
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]
    const hour = new Date().getHours()

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .eq('date', today)
      .single()

    let status = existing?.status || 'normal'
    if (hour < 18 && status !== 'late') status = 'early_leave'

    if (existing) {
      await supabase.from('attendance_records').update({ check_out: now, status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({
        employee_id: user.id, date: today, check_out: now, status: 'early_leave'
      })
    }
    setCheckOutLoading(false)
    loadData()
  }

  async function submitLeave() {
    if (!user || !leaveForm.start_date || !leaveForm.end_date) return
    const days = Math.floor((new Date(leaveForm.end_date).getTime() - new Date(leaveForm.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    await supabase.from('leave_requests').insert({
      employee_id: user.id,
      ...leaveForm,
      days,
      status: 'pending'
    })
    setShowLeaveForm(false)
    setLeaveForm({ start_date: '', end_date: '', type: 'annual', reason: '' })
    loadData()
  }

  async function submitOvertime() {
    if (!user || !otForm.date || !otForm.hours) return
    await supabase.from('overtime_records').insert({
      employee_id: user.id,
      date: otForm.date,
      hours: Number(otForm.hours),
      reason: otForm.reason,
      status: 'pending'
    })
    setShowOtForm(false)
    setOtForm({ date: '', hours: '', reason: '' })
    loadData()
  }

  async function submitMakeup() {
    if (!user || !makeupForm.date) return
    await supabase.from('makeup_requests').insert({
      employee_id: user.id,
      ...makeupForm,
      status: 'pending'
    })
    setShowMakeupForm(false)
    setMakeupForm({ date: '', check_in: '', check_out: '', reason: '' })
    loadData()
  }

  function logout() {
    localStorage.removeItem('attendance_user')
    router.push('/login')
  }

  function fmtTime(t: string | null | undefined) {
    if (!t) return '-'
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(t)) return t
    return new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  if (!user) return <div className="p-8">加载中...</div>

  const today = new Date().toISOString().split('T')[0]
  const todayRecord = attendance.find(a => a.date === today)
  const isCheckedIn = !!todayRecord?.check_in
  const isCheckedOut = !!todayRecord?.check_out

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">👋 欢迎，{user.name}</h1>
            <p className="text-sm text-gray-500">{user.department} · {user.position}</p>
          </div>
          <div className="flex gap-3">
            <span className="text-sm text-gray-500">工号: {user.employee_no}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:text-red-700">退出</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'dashboard', label: '📊 工作台' },
            { key: 'attendance', label: '📋 考勤记录' },
            { key: 'leave', label: '📝 请假' },
            { key: 'overtime', label: '⏰ 加班' },
            { key: 'makeup', label: '🔄 补卡' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">🕐 今日打卡</h2>
              <div className="flex gap-4">
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckedIn || checkInLoading}
                  className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-colors ${
                    isCheckedIn
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isCheckedIn ? '✅ 已上班打卡' : checkInLoading ? '打卡中...' : '📍 上班打卡'}
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={!isCheckedIn || isCheckedOut || checkOutLoading}
                  className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-colors ${
                    isCheckedOut
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : !isCheckedIn
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isCheckedOut ? '✅ 已下班打卡' : checkOutLoading ? '打卡中...' : '🏠 下班打卡'}
                </button>
              </div>
              {todayRecord && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm">
                    上班: {todayRecord.check_in ? fmtTime(todayRecord.check_in) : '未打卡'}
                    {' · '}
                    下班: {todayRecord.check_out ? fmtTime(todayRecord.check_out) : '未打卡'}
                    {' · '}
                    状态: <span className={STATUS_COLORS[todayRecord.status] || 'bg-gray-100'}>{STATUS_LABELS[todayRecord.status] || todayRecord.status}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '本月出勤', value: attendance.filter(a => a.status === 'normal' && a.date.startsWith(today.slice(0, 7))).length, color: 'bg-green-500' },
                { label: '本月迟到', value: attendance.filter(a => a.status === 'late' && a.date.startsWith(today.slice(0, 7))).length, color: 'bg-yellow-500' },
                { label: '请假天数', value: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + (l.days || 0), 0), color: 'bg-blue-500' },
                { label: '加班时长', value: overtimes.filter(o => o.status === 'approved').reduce((sum, o) => sum + (o.hours || 0), 0), color: 'bg-purple-500' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl shadow-sm p-4">
                  <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white mb-2`}>
                    {stat.value}
                  </div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Records */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">📋 最近考勤</h2>
              <div className="space-y-2">
                {attendance.slice(0, 5).map(record => (
                  <div key={record.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span>{record.date}</span>
                    <span className={STATUS_COLORS[record.status] || 'bg-gray-100'}>
                      {STATUS_LABELS[record.status] || record.status}
                    </span>
                  </div>
                ))}
                {attendance.length === 0 && <p className="text-gray-400 text-center py-4">暂无记录</p>}
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">📋 考勤记录</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">上班</th>
                    <th className="text-left py-2">下班</th>
                    <th className="text-left py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(record => (
                    <tr key={record.id} className="border-b">
                      <td className="py-2">{record.date}</td>
                      <td className="py-2">{record.check_in ? fmtTime(record.check_in) : '-'}</td>
                      <td className="py-2">{record.check_out ? fmtTime(record.check_out) : '-'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[record.status] || 'bg-gray-100'}`}>
                          {STATUS_LABELS[record.status] || record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {attendance.length === 0 && <p className="text-gray-400 text-center py-8">暂无记录</p>}
            </div>
          </div>
        )}

        {/* Leave Tab */}
        {tab === 'leave' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">📝 请假申请</h2>
                <button
                  onClick={() => setShowLeaveForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  + 申请请假
                </button>
              </div>

              {showLeaveForm && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm">开始日期</label>
                      <input
                        type="date"
                        value={leaveForm.start_date}
                        onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm">结束日期</label>
                      <input
                        type="date"
                        value={leaveForm.end_date}
                        onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-sm">请假类型</label>
                    <select
                      value={leaveForm.type}
                      onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="text-sm">原因</label>
                    <textarea
                      value={leaveForm.reason}
                      onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitLeave} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">提交</button>
                    <button onClick={() => setShowLeaveForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">取消</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {leaves.map(leave => (
                  <div key={leave.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">{LEAVE_TYPES[leave.type] || leave.type}</p>
                      <p className="text-sm text-gray-500">{leave.start_date} 至 {leave.end_date} · {leave.days}天</p>
                      <p className="text-sm text-gray-400">{leave.reason}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                      leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {leave.status === 'approved' ? '已通过' : leave.status === 'rejected' ? '已拒绝' : '审批中'}
                    </span>
                  </div>
                ))}
                {leaves.length === 0 && <p className="text-gray-400 text-center py-4">暂无请假记录</p>}
              </div>
            </div>
          </div>
        )}

        {/* Overtime Tab */}
        {tab === 'overtime' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">⏰ 加班申请</h2>
                <button
                  onClick={() => setShowOtForm(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  + 申请加班
                </button>
              </div>

              {showOtForm && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm">日期</label>
                      <input
                        type="date"
                        value={otForm.date}
                        onChange={e => setOtForm({...otForm, date: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm">时长（小时）</label>
                      <input
                        type="number"
                        step="0.5"
                        value={otForm.hours}
                        onChange={e => setOtForm({...otForm, hours: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-sm">原因</label>
                    <textarea
                      value={otForm.reason}
                      onChange={e => setOtForm({...otForm, reason: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitOvertime} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">提交</button>
                    <button onClick={() => setShowOtForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">取消</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {overtimes.map(ot => (
                  <div key={ot.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">{ot.date} · {ot.hours}小时</p>
                      <p className="text-sm text-gray-400">{ot.reason}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      ot.status === 'approved' ? 'bg-green-100 text-green-700' :
                      ot.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {ot.status === 'approved' ? '已通过' : ot.status === 'rejected' ? '已拒绝' : '审批中'}
                    </span>
                  </div>
                ))}
                {overtimes.length === 0 && <p className="text-gray-400 text-center py-4">暂无加班记录</p>}
              </div>
            </div>
          </div>
        )}

        {/* Makeup Tab */}
        {tab === 'makeup' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">🔄 补卡申请</h2>
                <button
                  onClick={() => setShowMakeupForm(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  + 申请补卡
                </button>
              </div>

              {showMakeupForm && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="mb-3">
                    <label className="text-sm">补卡日期</label>
                    <input
                      type="date"
                      value={makeupForm.date}
                      onChange={e => setMakeupForm({...makeupForm, date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm">上班时间</label>
                      <input
                        type="time"
                        value={makeupForm.check_in}
                        onChange={e => setMakeupForm({...makeupForm, check_in: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm">下班时间</label>
                      <input
                        type="time"
                        value={makeupForm.check_out}
                        onChange={e => setMakeupForm({...makeupForm, check_out: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-sm">补卡原因</label>
                    <textarea
                      value={makeupForm.reason}
                      onChange={e => setMakeupForm({...makeupForm, reason: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitMakeup} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm">提交</button>
                    <button onClick={() => setShowMakeupForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">取消</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {makeups.map(makeup => (
                  <div key={makeup.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">{makeup.date}</p>
                      <p className="text-sm text-gray-400">
                        上班: {makeup.check_in || '未填'} · 下班: {makeup.check_out || '未填'}
                      </p>
                      <p className="text-sm text-gray-400">{makeup.reason}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      makeup.status === 'approved' ? 'bg-green-100 text-green-700' :
                      makeup.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {makeup.status === 'approved' ? '已通过' : makeup.status === 'rejected' ? '已拒绝' : '审批中'}
                    </span>
                  </div>
                ))}
                {makeups.length === 0 && <p className="text-gray-400 text-center py-4">暂无补卡记录</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
