import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// ─── Types ───
interface Employee {
  id: number; name: string; department: string; position: string; email: string; created_at: string
  employee_no?: string; phone?: string; hire_date?: string; resignation_date?: string
  salary?: number; performance?: string
}
interface AttendanceRecord {
  id: number; employee_id: number; date: string; check_in: string | null; check_out: string | null
  status: string; notes: string; created_at: string; employee?: Employee
}
interface LeaveRequest {
  id: number; employee_id: number; start_date: string; end_date: string; days?: number
  type: string; status: string; reason: string; created_at: string; employee?: Employee
}
interface OvertimeRecord {
  id: number; employee_id: number; date: string; hours: number; status: string
  notes?: string; reason?: string; created_at: string; employee?: Employee
}
interface MakeupRequest {
  id: number; employee_id: number; date: string; check_in: string | null; check_out: string | null
  status: string; reason: string; created_at: string; employee?: Employee
}

// ─── Constants ───
const DEPARTMENTS = ['技术部', '产品部', '设计部', '运营部', '市场部', '人事部', '财务部']
const LEAVE_TYPES: Record<string, string> = { annual: '年假', sick: '病假', personal: '事假', maternity: '产假', other: '其他' }
const STATUS_LABELS: Record<string, string> = { normal: '正常', late: '迟到', early_leave: '早退', absent: '缺勤', leave: '请假', overtime: '加班' }
const STATUS_COLORS: Record<string, string> = { normal: '#5b8c5a', late: '#d4a853', early_leave: '#e8945a', absent: '#d35a4a', leave: '#5b8c85', overtime: '#5b7b8c' }
const CHART_COLORS = ['#5b8c5a', '#d4a853', '#e8945a', '#d35a4a', '#5b8c85', '#5b7b8c', '#8884d8']

function todayStr() { return new Date().toISOString().split('T')[0] }
function formatDate(d: string) { if (!d) return ''; return d.slice(5) }
function daysBetween(a: string, b: string) { return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)) + 1 }

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = '\uFEFF' + headers.join(',') + '\n' + rows.map(r => headers.map(h => {
    const v = r[h]; return v != null ? `"${String(v).replace(/"/g, '""')}"` : ''
  }).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Auth Guard ───
function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  useEffect(() => {
    const stored = localStorage.getItem('attendance_user')
    if (!stored) { router.push('/login'); return }
    const parsed = JSON.parse(stored)
    if (parsed.role !== 'admin') { router.push('/employee'); return }
    setUser(parsed); setAuthLoading(false)
  }, [router])
  return { user, authLoading }
}

export default function AdminDashboard() {
  const { user, authLoading } = useAuth()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([])
  const [makeups, setMakeups] = useState<MakeupRequest[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'employees' | 'attendance' | 'calendar' | 'approvals' | 'leave' | 'overtime' | 'makeup' | 'contracts' | 'stats' | 'monthly'>('employees')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('全部')

  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [empForm, setEmpForm] = useState({ name: '', department: '技术部', position: '', email: '', phone: '', hire_date: '', resignation_date: '', salary: '', performance: '' })

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [checkNote, setCheckNote] = useState('')

  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ employee_id: '', start_date: '', end_date: '', type: 'annual' as const, reason: '' })

  const [showOtForm, setShowOtForm] = useState(false)
  const [otForm, setOtForm] = useState({ employee_id: '', date: '', hours: '', notes: '' })

  const [showMakeupForm, setShowMakeupForm] = useState(false)
  const [makeupForm, setMakeupForm] = useState({ employee_id: '', date: '', check_in: '', check_out: '', reason: '' })
  const [showContractForm, setShowContractForm] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [contractForm, setContractForm] = useState({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' })

  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

  // Monthly report
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1)

  // ─── Data Loading ───
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, aRes, lRes, oRes, mRes, cRes] = await Promise.all([
        supabase.from('employees').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance_records').select('*, employee:employees(*)').order('date', { ascending: false }),
        supabase.from('leave_requests').select('*, employee:employees!leave_requests_employee_id_fkey(*)').order('created_at', { ascending: false }),
        supabase.from('overtime_records').select('*, employee:employees(*)').order('created_at', { ascending: false }),
        supabase.from('makeup_requests').select('*, employee:employees(*)').order('created_at', { ascending: false }),
        supabase.from('contracts').select('*, employee:employees(*)').order('created_at', { ascending: false })
      ])
      if (eRes.error) throw eRes.error
      if (aRes.error) throw aRes.error
      if (lRes.error) throw lRes.error
      if (oRes.error) throw oRes.error
      if (mRes.error) throw mRes.error
      setContracts(cRes?.data || [])
      setEmployees(eRes.data || [])
      setAttendance(aRes.data || [])
      setLeaves(lRes.data || [])
      setOvertimes(oRes.data || [])
      setMakeups(mRes.data || [])
      setError(null)
    } catch (err: any) { setError(err.message || '加载失败') } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t) } }, [error])

  // ─── Employee CRUD ───
  async function saveEmployee() {
    if (!empForm.name.trim() || !empForm.position.trim()) return
    const payload: any = { ...empForm }
    if (payload.salary) payload.salary = parseFloat(payload.salary)
    if (editingEmp) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editingEmp.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('employees').insert(payload)
      if (error) { setError(error.message); return }
    }
    setShowEmpForm(false); setEditingEmp(null)
    setEmpForm({ name: '', department: '技术部', position: '', email: '', phone: '', hire_date: '', resignation_date: '', salary: '', performance: '' }); loadAll()
  }
  async function deleteEmployee(id: number) {
    if (!confirm('确定删除该员工？')) return
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }
  function editEmployee(emp: Employee) {
    setEditingEmp(emp)
    setEmpForm({ name: emp.name, department: emp.department, position: emp.position, email: emp.email || '', phone: emp.phone || '', hire_date: emp.hire_date || '', resignation_date: emp.resignation_date || '', salary: emp.salary != null ? String(emp.salary) : '', performance: emp.performance || '' })
    setShowEmpForm(true)
  }

  // ─── Attendance ───
  async function checkIn(empId: number) {
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('employee_id', empId).eq('date', selectedDate).single()
    const now = new Date().toTimeString().split(' ')[0]
    const hour = new Date().getHours()
    const status = hour >= 9 ? 'late' : 'normal'
    if (existing) {
      await supabase.from('attendance_records').update({ check_in: now, status: existing.check_out ? existing.status : status, notes: checkNote || existing.notes }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({ employee_id: empId, date: selectedDate, check_in: now, status, notes: checkNote })
    }
    setCheckNote(''); loadAll()
  }
  async function checkOut(empId: number) {
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('employee_id', empId).eq('date', selectedDate).single()
    const now = new Date().toTimeString().split(' ')[0]
    const hour = new Date().getHours()
    let status = existing?.status || 'normal'
    if (hour < 18 && status !== 'late') status = 'early_leave'
    if (existing) {
      await supabase.from('attendance_records').update({ check_out: now, status, notes: checkNote || existing.notes }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({ employee_id: empId, date: selectedDate, check_out: now, status: 'early_leave', notes: checkNote })
    }
    setCheckNote(''); loadAll()
  }
  async function markAbsent(empId: number) {
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('employee_id', empId).eq('date', selectedDate).single()
    if (existing) {
      await supabase.from('attendance_records').update({ status: 'absent' }).eq('id', existing.id)
    } else {
      await supabase.from('attendance_records').insert({ employee_id: empId, date: selectedDate, status: 'absent', notes: checkNote })
    }
    loadAll()
  }

  // ─── Leave CRUD ───
  async function saveLeave() {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) return
    const days = daysBetween(leaveForm.start_date, leaveForm.end_date)
    const { error } = await supabase.from('leave_requests').insert({ employee_id: Number(leaveForm.employee_id), start_date: leaveForm.start_date, end_date: leaveForm.end_date, days, type: leaveForm.type, reason: leaveForm.reason, status: 'pending' })
    if (error) { setError(error.message); return }
    setShowLeaveForm(false); setLeaveForm({ employee_id: '', start_date: '', end_date: '', type: 'annual', reason: '' }); loadAll()
  }
  async function updateLeaveStatus(id: number, status: string) {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }
  async function deleteLeave(id: number) {
    if (!confirm('确定删除？')) return
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }

  // ─── Overtime CRUD ───
  async function saveOvertime() {
    if (!otForm.employee_id || !otForm.date || !otForm.hours) return
    const { error } = await supabase.from('overtime_records').insert({ employee_id: Number(otForm.employee_id), date: otForm.date, hours: Number(otForm.hours), notes: otForm.notes, reason: otForm.notes, status: 'pending' })
    if (error) { setError(error.message); return }
    setShowOtForm(false); setOtForm({ employee_id: '', date: '', hours: '', notes: '' }); loadAll()
  }
  async function updateOtStatus(id: number, status: string) {
    const { error } = await supabase.from('overtime_records').update({ status }).eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }
  async function deleteOvertime(id: number) {
    if (!confirm('确定删除？')) return
    const { error } = await supabase.from('overtime_records').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }

  // ─── Makeup CRUD ───
  async function saveMakeup() {
    if (!makeupForm.employee_id || !makeupForm.date) return
    const { error } = await supabase.from('makeup_requests').insert({ employee_id: Number(makeupForm.employee_id), date: makeupForm.date, check_in: makeupForm.check_in || null, check_out: makeupForm.check_out || null, reason: makeupForm.reason, status: 'pending' })
    if (error) { setError(error.message); return }
    setShowMakeupForm(false); setMakeupForm({ employee_id: '', date: '', check_in: '', check_out: '', reason: '' }); loadAll()
  }
  async function updateMakeupStatus(id: number, status: string) {
    const { error } = await supabase.from('makeup_requests').update({ status }).eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }
  async function deleteMakeup(id: number) {
    if (!confirm('确定删除？')) return
    const { error } = await supabase.from('makeup_requests').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }

  // ─── Contract CRUD ───
  async function saveContract() {
    if (!contractForm.employee_id || !contractForm.start_date) return
    if (editingContract) {
      const { error } = await supabase.from('contracts').update(contractForm).eq('id', editingContract.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('contracts').insert(contractForm)
      if (error) { setError(error.message); return }
    }
    setShowContractForm(false); setEditingContract(null)
    setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); loadAll()
  }
  async function deleteContract(id: number) {
    if (!confirm('确定删除该合同？')) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setError(error.message); else loadAll()
  }
  function editContract(c: Contract) {
    setEditingContract(c)
    setContractForm({ employee_id: String(c.employee_id), contract_type: c.contract_type, start_date: c.start_date, end_date: c.end_date || '', file_url: c.file_url || '', notes: c.notes || '' })
    setShowContractForm(true)
  }

  function logout() { localStorage.removeItem('attendance_user'); router.push('/login') }

  // ─── Derived Data ───
  const filteredEmployees = useMemo(() => employees.filter(e => {
    const ms = !search || e.name.includes(search) || e.position.includes(search) || e.email?.includes(search)
    const md = deptFilter === '全部' || e.department === deptFilter
    return ms && md
  }), [employees, search, deptFilter])

  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'pending'), [leaves])
  const pendingOvertimes = useMemo(() => overtimes.filter(o => o.status === 'pending'), [overtimes])
  const pendingMakeups = useMemo(() => makeups.filter(m => m.status === 'pending'), [makeups])

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

    const deptStats: Record<string, { total: number; present: number; absent: number }> = {}
    employees.forEach(e => { deptStats[e.department] = deptStats[e.department] || { total: 0, present: 0, absent: 0 } })
    todayAttendance.forEach(a => {
      const emp = employees.find(e => e.id === a.employee_id)
      if (!emp) return
      const d = deptStats[emp.department]; d.total++
      if (a.status === 'absent' || a.status === 'leave') d.absent++; else d.present++
    })

    // 7-day trend
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const dayRecs = attendance.filter(a => a.date === ds)
      trend.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        present: dayRecs.filter(a => a.status !== 'absent' && a.status !== 'leave').length,
        absent: dayRecs.filter(a => a.status === 'absent').length,
        late: dayRecs.filter(a => a.status === 'late').length
      })
    }

    // Status distribution for pie chart
    const statusDist = [
      { name: '正常', value: attendance.filter(a => a.status === 'normal').length },
      { name: '迟到', value: attendance.filter(a => a.status === 'late').length },
      { name: '早退', value: attendance.filter(a => a.status === 'early_leave').length },
      { name: '缺勤', value: attendance.filter(a => a.status === 'absent').length },
      { name: '请假', value: attendance.filter(a => a.status === 'leave').length },
      { name: '加班', value: attendance.filter(a => a.status === 'overtime').length },
    ].filter(s => s.value > 0)

    // Department attendance bar chart
    const deptChart = Object.entries(deptStats).map(([dept, d]) => ({
      name: dept, 出勤: d.present, 缺勤: d.absent
    }))

    // Leave type distribution
    const leaveTypeDist: Record<string, number> = {}
    leaves.forEach(l => { leaveTypeDist[l.type] = (leaveTypeDist[l.type] || 0) + 1 })
    const leaveTypeChart = Object.entries(leaveTypeDist).map(([k, v]) => ({ name: LEAVE_TYPES[k] || k, value: v }))

    return { totalEmp, checkedIn, checkedOut, attendanceRate, lateCount, earlyCount, absentCount, leaveCount, deptStats, trend, statusDist, deptChart, leaveTypeChart }
  }, [employees, attendance, leaves, selectedDate])

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const prefix = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}`
    const monthAttendance = attendance.filter(a => a.date.startsWith(prefix))
    return employees.map(emp => {
      const empAtt = monthAttendance.filter(a => a.employee_id === emp.id)
      const present = empAtt.filter(a => a.status === 'normal' || a.status === 'overtime').length
      const late = empAtt.filter(a => a.status === 'late').length
      const early = empAtt.filter(a => a.status === 'early_leave').length
      const absent = empAtt.filter(a => a.status === 'absent').length
      const leave = empAtt.filter(a => a.status === 'leave').length
      const overtimeHrs = overtimes.filter(o => o.employee_id === emp.id && o.date.startsWith(prefix) && o.status === 'approved').reduce((s, o) => s + (o.hours || 0), 0)
      return { name: emp.name, department: emp.department, present, late, early, absent, leave, overtimeHrs, total: empAtt.length }
    })
  }, [employees, attendance, overtimes, monthlyYear, monthlyMonth])

  // Calendar
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1); const last = new Date(calYear, calMonth + 1, 0)
    const days: (number | null)[] = []
    for (let i = 0; i < first.getDay(); i++) days.push(null)
    for (let i = 1; i <= last.getDate(); i++) days.push(i)
    return days
  }, [calYear, calMonth])
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>()
    attendance.forEach(a => { if (!map.has(a.date)) map.set(a.date, []); map.get(a.date)!.push(a) })
    return map
  }, [attendance])
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const tabLabels: Record<string, string> = { employees: '员工管理', attendance: '每日考勤', calendar: '考勤日历', approvals: '待审批', leave: '请假管理', overtime: '加班记录', makeup: '补卡管理', contracts: '合同管理', stats: '统计报表', monthly: '月度汇总' }

  if (authLoading) return <div className="loading"><div className="spinner" /></div>
  if (!user) return null

  // ─── Render ───
  return (
    <div className="app">
      <header className="header glass-panel">
        <h1>考勤管理系统</h1>
        <div className="header-actions">
          {user && <span className="user-info">{user.name}</span>}
          <button className="btn-logout" onClick={logout}>退出</button>
          <button className="btn-refresh" onClick={loadAll} disabled={loading} title="刷新">&#x21bb;</button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="tabs">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}${key === 'approvals' && (pendingLeaves.length + pendingOvertimes.length + pendingMakeups.length) > 0 ? ' has-badge' : ''}`} onClick={() => setTab(key as any)}>
            {label}
            {key === 'approvals' && (pendingLeaves.length + pendingOvertimes.length + pendingMakeups.length) > 0 && (
              <span className="tab-badge">{pendingLeaves.length + pendingOvertimes.length + pendingMakeups.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Employees Tab ─── */}
      {tab === 'employees' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <input className="search-input" placeholder="搜索员工..." value={search} onChange={e => setSearch(e.target.value)} />
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="全部">全部部门</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button className="btn-secondary" onClick={() => downloadCSV(
              filteredEmployees.map(e => ({ 姓名: e.name, 部门: e.department, 职位: e.position, 邮箱: e.email || '', 入职: e.created_at?.split('T')[0] || '' })),
              `员工列表_${todayStr()}.csv`
            )}>导出CSV</button>
            <button className="btn-primary" onClick={() => { setEditingEmp(null); setEmpForm({ name: '', department: '技术部', position: '', email: '', phone: '', hire_date: '', resignation_date: '', salary: '', performance: '' }); setShowEmpForm(true) }}>添加员工</button>
          </div>

          {showEmpForm && (
            <div className="modal-overlay" onClick={() => setShowEmpForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>{editingEmp ? '编辑员工' : '添加员工'}</h3>
                <input placeholder="姓名" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} />
                <select value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select>
                <input placeholder="职位" value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} />
                <input placeholder="邮箱" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
                <input placeholder="电话" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} />
                <input type="date" placeholder="入职日期" value={empForm.hire_date} onChange={e => setEmpForm({ ...empForm, hire_date: e.target.value })} />
                <input type="date" placeholder="离职日期" value={empForm.resignation_date} onChange={e => setEmpForm({ ...empForm, resignation_date: e.target.value })} />
                <input type="number" placeholder="薪资（月薪）" value={empForm.salary} onChange={e => setEmpForm({ ...empForm, salary: e.target.value })} step="0.01" />
                <select value={empForm.performance} onChange={e => setEmpForm({ ...empForm, performance: e.target.value })}>
                  <option value="">绩效评级</option>
                  <option value="S">S - 卓越</option>
                  <option value="A">A - 优秀</option>
                  <option value="B">B - 良好</option>
                  <option value="C">C - 待改进</option>
                  <option value="D">D - 不合格</option>
                </select>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowEmpForm(false)}>取消</button>
                  <button className="btn-primary" onClick={saveEmployee}>保存</button>
                </div>
              </div>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead><tr><th>姓名</th><th>部门</th><th>职位</th><th>电话</th><th>入职</th><th>薪资</th><th>操作</th></tr></thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id}>
                    <td><strong>{emp.name}</strong></td>
                    <td><span className="tag">{emp.department}</span></td>
                    <td>{emp.position}</td>
                    <td className="cell-truncate">{emp.phone || '-'}</td>
                    <td>{formatDate((emp.hire_date || emp.created_at)?.split('T')[0])}</td>
                    <td>{emp.salary != null ? '¥' + emp.salary.toLocaleString() : '-'}</td>
                    <td>
                      <button className="btn-small" onClick={() => editEmployee(emp)}>编辑</button>
                      <button className="btn-small btn-danger" onClick={() => deleteEmployee(emp.id)}>删除</button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && <tr><td colSpan={7} className="empty">暂无员工</td></tr>}
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
            <span className="toolbar-info">{employees.length} 人</span>
            <button className="btn-secondary" onClick={() => downloadCSV(
              employees.map(emp => {
                const rec = attendance.find(a => a.employee_id === emp.id && a.date === selectedDate)
                return { 姓名: emp.name, 部门: emp.department, 签到: rec?.check_in || '-', 签退: rec?.check_out || '-', 状态: STATUS_LABELS[rec?.status || ''] || '未打卡' }
              }),
              `每日考勤_${selectedDate}.csv`
            )}>导出CSV</button>
          </div>
          <div className="checkin-grid">
            {employees.map(emp => {
              const rec = attendance.find(a => a.employee_id === emp.id && a.date === selectedDate)
              return (
                <div key={emp.id} className="checkin-card">
                  <div className="checkin-header">
                    <strong>{emp.name}</strong>
                    <span className="tag">{emp.department}</span>
                  </div>
                  <div className="checkin-status">
                    {rec ? (
                      <>
                        <span className="status-badge" style={{ background: STATUS_COLORS[rec.status] + '20', color: STATUS_COLORS[rec.status] }}>{STATUS_LABELS[rec.status]}</span>
                        <div className="checkin-times">
                          {rec.check_in && <span>签到 {rec.check_in}</span>}
                          {rec.check_out && <span>签退 {rec.check_out}</span>}
                        </div>
                      </>
                    ) : <span className="status-badge" style={{ background: '#f0f0f0', color: '#999' }}>未打卡</span>}
                  </div>
                  <div className="checkin-actions">
                    <button className="btn-small" onClick={() => checkIn(emp.id)} disabled={!!rec?.check_in}>{rec?.check_in ? '已签到' : '签到'}</button>
                    <button className="btn-small" onClick={() => checkOut(emp.id)} disabled={!rec?.check_in || !!rec?.check_out}>{rec?.check_out ? '已签退' : '签退'}</button>
                    <button className="btn-small btn-danger" onClick={() => markAbsent(emp.id)}>缺勤</button>
                  </div>
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
            <button className="cal-nav" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}>&#x25c0;</button>
            <span className="cal-title">{calYear}年 {calMonth + 1}月</span>
            <button className="cal-nav" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}>&#x25b6;</button>
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
                <div key={ds} className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => { setSelectedDate(ds); setTab('attendance') }}>
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
          <div className="calendar-legend"><span><span className="day-dot normal" />正常</span><span><span className="day-dot late" />迟到</span><span><span className="day-dot early" />早退</span><span><span className="day-dot absent" />缺勤</span></div>
        </div>
      )}

      {/* ─── Approvals Tab ─── */}
      {tab === 'approvals' && (
        <div className="panel glass-panel">
          {/* Pending Leaves */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>请假审批 ({pendingLeaves.length})</h3>
          {pendingLeaves.length > 0 ? (
            <div className="data-table" style={{ marginBottom: 24 }}>
              <table>
                <thead><tr><th>员工</th><th>部门</th><th>类型</th><th>日期</th><th>天数</th><th>原因</th><th>操作</th></tr></thead>
                <tbody>
                  {pendingLeaves.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.employee?.name}</strong></td>
                      <td><span className="tag">{l.employee?.department}</span></td>
                      <td>{LEAVE_TYPES[l.type]}</td>
                      <td>{formatDate(l.start_date)} - {formatDate(l.end_date)}</td>
                      <td>{(l.days || daysBetween(l.start_date, l.end_date))} 天</td>
                      <td className="cell-truncate" title={l.reason}>{l.reason || '-'}</td>
                      <td>
                        <button className="btn-small" onClick={() => updateLeaveStatus(l.id, 'approved')}>批准</button>
                        <button className="btn-small btn-danger" onClick={() => updateLeaveStatus(l.id, 'rejected')}>拒绝</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>暂无待审批请假</p>}

          {/* Pending Overtimes */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>加班审批 ({pendingOvertimes.length})</h3>
          {pendingOvertimes.length > 0 ? (
            <div className="data-table" style={{ marginBottom: 24 }}>
              <table>
                <thead><tr><th>员工</th><th>部门</th><th>日期</th><th>时长</th><th>原因</th><th>操作</th></tr></thead>
                <tbody>
                  {pendingOvertimes.map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.employee?.name}</strong></td>
                      <td><span className="tag">{o.employee?.department}</span></td>
                      <td>{formatDate(o.date)}</td>
                      <td>{o.hours} 小时</td>
                      <td className="cell-truncate" title={o.reason || o.notes}>{o.reason || o.notes || '-'}</td>
                      <td>
                        <button className="btn-small" onClick={() => updateOtStatus(o.id, 'approved')}>批准</button>
                        <button className="btn-small btn-danger" onClick={() => updateOtStatus(o.id, 'rejected')}>拒绝</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>暂无待审批加班</p>}

          {/* Pending Makeups */}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>补卡审批 ({pendingMakeups.length})</h3>
          {pendingMakeups.length > 0 ? (
            <div className="data-table">
              <table>
                <thead><tr><th>员工</th><th>部门</th><th>日期</th><th>上班</th><th>下班</th><th>原因</th><th>操作</th></tr></thead>
                <tbody>
                  {pendingMakeups.map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.employee?.name}</strong></td>
                      <td><span className="tag">{m.employee?.department}</span></td>
                      <td>{formatDate(m.date)}</td>
                      <td>{m.check_in || '-'}</td>
                      <td>{m.check_out || '-'}</td>
                      <td className="cell-truncate" title={m.reason}>{m.reason || '-'}</td>
                      <td>
                        <button className="btn-small" onClick={() => updateMakeupStatus(m.id, 'approved')}>批准</button>
                        <button className="btn-small btn-danger" onClick={() => updateMakeupStatus(m.id, 'rejected')}>拒绝</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>暂无待审批补卡</p>}

          {pendingLeaves.length === 0 && pendingOvertimes.length === 0 && pendingMakeups.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>全部审批完毕</div>
          )}
        </div>
      )}

      {/* ─── Leave Tab ─── */}
      {tab === 'leave' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <button className="btn-secondary" onClick={() => downloadCSV(
              leaves.map(l => ({ 员工: l.employee?.name || '', 部门: l.employee?.department || '', 类型: LEAVE_TYPES[l.type] || l.type, 开始: l.start_date, 结束: l.end_date, 天数: l.days || daysBetween(l.start_date, l.end_date), 状态: l.status === 'approved' ? '已通过' : l.status === 'rejected' ? '已拒绝' : '审批中', 原因: l.reason || '' })),
              `请假记录_${todayStr()}.csv`
            )}>导出CSV</button>
            <button className="btn-primary" onClick={() => setShowLeaveForm(true)}>申请请假</button>
          </div>
          {showLeaveForm && (
            <div className="modal-overlay" onClick={() => setShowLeaveForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>申请请假</h3>
                <select value={leaveForm.employee_id} onChange={e => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}>
                  <option value="">选择员工</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
                <label>开始日期</label><input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
                <label>结束日期</label><input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
                <select value={leaveForm.type} onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value as any })}>{Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <textarea placeholder="请假原因" rows={3} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                <div className="modal-actions"><button className="btn-secondary" onClick={() => setShowLeaveForm(false)}>取消</button><button className="btn-primary" onClick={saveLeave}>提交</button></div>
              </div>
            </div>
          )}
          <div className="data-table">
            <table>
              <thead><tr><th>员工</th><th>部门</th><th>类型</th><th>日期</th><th>天数</th><th>原因</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employee?.name}</strong></td>
                    <td><span className="tag">{l.employee?.department}</span></td>
                    <td>{LEAVE_TYPES[l.type]}</td>
                    <td>{formatDate(l.start_date)} - {formatDate(l.end_date)}</td>
                    <td>{(l.days || daysBetween(l.start_date, l.end_date))} 天</td>
                    <td className="cell-truncate" title={l.reason}>{l.reason || '-'}</td>
                    <td><span className={`status-badge ${l.status}`}>{l.status === 'pending' ? '待审批' : l.status === 'approved' ? '已批准' : '已拒绝'}</span></td>
                    <td>
                      {l.status === 'pending' && <><button className="btn-small" onClick={() => updateLeaveStatus(l.id, 'approved')}>批准</button><button className="btn-small btn-danger" onClick={() => updateLeaveStatus(l.id, 'rejected')}>拒绝</button></>}
                      <button className="btn-small btn-danger" onClick={() => deleteLeave(l.id)}>删除</button>
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
            <button className="btn-secondary" onClick={() => downloadCSV(
              overtimes.map(o => ({ 员工: o.employee?.name || '', 部门: o.employee?.department || '', 日期: o.date, 时长: o.hours + 'h', 状态: o.status === 'approved' ? '已通过' : o.status === 'rejected' ? '已拒绝' : '审批中', 原因: o.reason || o.notes || '' })),
              `加班记录_${todayStr()}.csv`
            )}>导出CSV</button>
            <button className="btn-primary" onClick={() => setShowOtForm(true)}>申请加班</button>
          </div>
          {showOtForm && (
            <div className="modal-overlay" onClick={() => setShowOtForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>申请加班</h3>
                <select value={otForm.employee_id} onChange={e => setOtForm({ ...otForm, employee_id: e.target.value })}><option value="">选择员工</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                <label>日期</label><input type="date" value={otForm.date} onChange={e => setOtForm({ ...otForm, date: e.target.value })} />
                <label>时长（小时）</label><input type="number" step="0.5" value={otForm.hours} onChange={e => setOtForm({ ...otForm, hours: e.target.value })} />
                <textarea placeholder="备注" rows={2} value={otForm.notes} onChange={e => setOtForm({ ...otForm, notes: e.target.value })} />
                <div className="modal-actions"><button className="btn-secondary" onClick={() => setShowOtForm(false)}>取消</button><button className="btn-primary" onClick={saveOvertime}>提交</button></div>
              </div>
            </div>
          )}
          <div className="data-table">
            <table>
              <thead><tr><th>员工</th><th>部门</th><th>日期</th><th>时长</th><th>备注</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {overtimes.map(o => (
                  <tr key={o.id}>
                    <td><strong>{o.employee?.name}</strong></td>
                    <td><span className="tag">{o.employee?.department}</span></td>
                    <td>{formatDate(o.date)}</td>
                    <td>{o.hours} 小时</td>
                    <td className="cell-truncate" title={o.notes || o.reason}>{o.notes || o.reason || '-'}</td>
                    <td><span className={`status-badge ${o.status}`}>{o.status === 'pending' ? '待审批' : o.status === 'approved' ? '已批准' : '已拒绝'}</span></td>
                    <td>
                      {o.status === 'pending' && <><button className="btn-small" onClick={() => updateOtStatus(o.id, 'approved')}>批准</button><button className="btn-small btn-danger" onClick={() => updateOtStatus(o.id, 'rejected')}>拒绝</button></>}
                      <button className="btn-small btn-danger" onClick={() => deleteOvertime(o.id)}>删除</button>
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
            <button className="btn-secondary" onClick={() => downloadCSV(
              makeups.map(m => ({ 员工: m.employee?.name || '', 部门: m.employee?.department || '', 日期: m.date, 上班: m.check_in || '-', 下班: m.check_out || '-', 状态: m.status === 'approved' ? '已通过' : m.status === 'rejected' ? '已拒绝' : '审批中', 原因: m.reason || '' })),
              `补卡记录_${todayStr()}.csv`
            )}>导出CSV</button>
            <button className="btn-primary" onClick={() => setShowMakeupForm(true)}>申请补卡</button>
          </div>
          {showMakeupForm && (
            <div className="modal-overlay" onClick={() => setShowMakeupForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>申请补卡</h3>
                <select value={makeupForm.employee_id} onChange={e => setMakeupForm({ ...makeupForm, employee_id: e.target.value })}><option value="">选择员工</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                <label>日期</label><input type="date" value={makeupForm.date} onChange={e => setMakeupForm({ ...makeupForm, date: e.target.value })} />
                <label>上班时间</label><input type="time" value={makeupForm.check_in} onChange={e => setMakeupForm({ ...makeupForm, check_in: e.target.value })} />
                <label>下班时间</label><input type="time" value={makeupForm.check_out} onChange={e => setMakeupForm({ ...makeupForm, check_out: e.target.value })} />
                <textarea placeholder="原因" rows={3} value={makeupForm.reason} onChange={e => setMakeupForm({ ...makeupForm, reason: e.target.value })} />
                <div className="modal-actions"><button className="btn-secondary" onClick={() => setShowMakeupForm(false)}>取消</button><button className="btn-primary" onClick={saveMakeup}>提交</button></div>
              </div>
            </div>
          )}
          <div className="data-table">
            <table>
              <thead><tr><th>员工</th><th>部门</th><th>日期</th><th>上班</th><th>下班</th><th>原因</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {makeups.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.employee?.name}</strong></td>
                    <td><span className="tag">{m.employee?.department}</span></td>
                    <td>{formatDate(m.date)}</td>
                    <td>{m.check_in || '-'}</td>
                    <td>{m.check_out || '-'}</td>
                    <td className="cell-truncate" title={m.reason}>{m.reason || '-'}</td>
                    <td><span className={`status-badge ${m.status}`}>{m.status === 'pending' ? '待审批' : m.status === 'approved' ? '已批准' : '已拒绝'}</span></td>
                    <td>
                      {m.status === 'pending' && <><button className="btn-small" onClick={() => updateMakeupStatus(m.id, 'approved')}>批准</button><button className="btn-small btn-danger" onClick={() => updateMakeupStatus(m.id, 'rejected')}>拒绝</button></>}
                      <button className="btn-small btn-danger" onClick={() => deleteMakeup(m.id)}>删除</button>
                    </td>
                  </tr>
                ))}
                {makeups.length === 0 && <tr><td colSpan={8} className="empty">暂无补卡记录</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Contracts Tab ─── */}
      {tab === 'contracts' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <button className="btn-primary" onClick={() => { setEditingContract(null); setContractForm({ employee_id: '', contract_type: '劳动合同', start_date: '', end_date: '', file_url: '', notes: '' }); setShowContractForm(true) }}>新增合同</button>
            <button className="btn-secondary" onClick={() => downloadCSV(
              contracts.map(c => ({ 员工: c.employee?.name || '', 部门: c.employee?.department || '', 类型: c.contract_type, 开始: c.start_date, 结束: c.end_date || '无固定', 状态: c.status })), `合同列表_${todayStr()}.csv`
            )}>导出CSV</button>
            <span className="toolbar-info">{contracts.length} 份合同</span>
          </div>

          {showContractForm && (
            <div className="modal-overlay" onClick={() => setShowContractForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>{editingContract ? '编辑合同' : '新增合同'}</h3>
                <select value={contractForm.employee_id} onChange={e => setContractForm({ ...contractForm, employee_id: e.target.value })}>
                  <option value="">选择员工</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
                <select value={contractForm.contract_type} onChange={e => setContractForm({ ...contractForm, contract_type: e.target.value })}>
                  <option value="劳动合同">劳动合同</option>
                  <option value="保密协议">保密协议</option>
                  <option value="竞业协议">竞业协议</option>
                  <option value="实习协议">实习协议</option>
                  <option value="劳务合同">劳务合同</option>
                </select>
                <input type="date" placeholder="开始日期" value={contractForm.start_date} onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })} />
                <input type="date" placeholder="结束日期（可选）" value={contractForm.end_date} onChange={e => setContractForm({ ...contractForm, end_date: e.target.value })} />
                <input placeholder="文件链接（可选）" value={contractForm.file_url} onChange={e => setContractForm({ ...contractForm, file_url: e.target.value })} />
                <textarea placeholder="备注" value={contractForm.notes} onChange={e => setContractForm({ ...contractForm, notes: e.target.value })} rows={2} />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowContractForm(false)}>取消</button>
                  <button className="btn-primary" onClick={saveContract}>保存</button>
                </div>
              </div>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead><tr><th>员工</th><th>部门</th><th>类型</th><th>开始日期</th><th>结束日期</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {contracts.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.employee?.name || '-'}</strong></td>
                    <td><span className="tag">{c.employee?.department || '-'}</span></td>
                    <td>{c.contract_type}</td>
                    <td>{c.start_date}</td>
                    <td>{c.end_date || '无固定期限'}</td>
                    <td><span className={`status-badge ${c.status === 'active' ? 'approved' : 'rejected'}`}>{c.status === 'active' ? '有效' : '已终止'}</span></td>
                    <td>
                      <button className="btn-small" onClick={() => editContract(c)}>编辑</button>
                      <button className="btn-small btn-danger" onClick={() => deleteContract(c.id)}>删除</button>
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && <tr><td colSpan={7} className="empty">暂无合同</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Stats Tab ─── */}
      {tab === 'stats' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>考勤概览</h3>
            <button className="btn-secondary" onClick={() => downloadCSV(
              stats.trend.map((t: any) => ({ 日期: t.date, 出勤: t.present, 缺勤: t.absent, 迟到: t.late })),
              `考勤趋势_${todayStr()}.csv`
            )}>导出趋势CSV</button>
          </div>

          <div className="stats-cards">
            {[{ label: '总人数', value: stats.totalEmp }, { label: '今日签到', value: stats.checkedIn }, { label: '今日签退', value: stats.checkedOut }, { label: '出勤率', value: stats.attendanceRate + '%' }]
              .map(s => <div key={s.label} className="stat-card"><div className="stat-number">{s.value}</div><div className="stat-label">{s.label}</div></div>)}
          </div>
          <div className="stats-cards">
            {[{ label: '迟到', value: stats.lateCount }, { label: '早退', value: stats.earlyCount }, { label: '缺勤', value: stats.absentCount }, { label: '请假', value: stats.leaveCount }]
              .map(s => <div key={s.label} className="stat-card"><div className="stat-number">{s.value}</div><div className="stat-label">{s.label}</div></div>)}
          </div>

          {/* 7-Day Trend Chart */}
          <div className="stats-section">
            <h3>近 7 天出勤趋势</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" fontSize={12} stroke="var(--text-muted)" />
                <YAxis fontSize={12} stroke="var(--text-muted)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="present" name="出勤" stroke="#5b8c5a" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="late" name="迟到" stroke="#d4a853" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="absent" name="缺勤" stroke="#d35a4a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Department Bar Chart */}
          {stats.deptChart.length > 0 && (
            <div className="stats-section">
              <h3>部门出勤对比 ({selectedDate})</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.deptChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" fontSize={12} stroke="var(--text-muted)" />
                  <YAxis fontSize={12} stroke="var(--text-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="出勤" fill="#5b8c5a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="缺勤" fill="#d35a4a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Status Pie + Leave Type Pie */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {stats.statusDist.length > 0 && (
              <div className="stats-section" style={{ flex: 1, minWidth: 280 }}>
                <h3>考勤状态分布</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={stats.statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {stats.statusDist.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {stats.leaveTypeChart.length > 0 && (
              <div className="stats-section" style={{ flex: 1, minWidth: 280 }}>
                <h3>请假类型分布</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={stats.leaveTypeChart} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {stats.leaveTypeChart.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Monthly Summary Tab ─── */}
      {tab === 'monthly' && (
        <div className="panel glass-panel">
          <div className="panel-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>月度汇总</h3>
            <select value={monthlyYear} onChange={e => setMonthlyYear(Number(e.target.value))} style={{ width: 80 }}>
              {[monthlyYear - 1, monthlyYear, monthlyYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={monthlyMonth} onChange={e => setMonthlyMonth(Number(e.target.value))} style={{ width: 60 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <button className="btn-secondary" onClick={() => downloadCSV(
              monthlySummary.map(s => ({ 姓名: s.name, 部门: s.department, 出勤天数: s.present, 迟到: s.late, 早退: s.early, 缺勤: s.absent, 请假: s.leave, 加班时长: s.overtimeHrs + 'h', 总记录: s.total })),
              `月度汇总_${monthlyYear}年${monthlyMonth}月.csv`
            )}>导出CSV</button>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>姓名</th><th>部门</th><th>出勤</th><th>迟到</th><th>早退</th><th>缺勤</th><th>请假</th><th>加班(h)</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map(s => (
                  <tr key={s.name}>
                    <td><strong>{s.name}</strong></td>
                    <td><span className="tag">{s.department}</span></td>
                    <td><span style={{ color: '#5b8c5a', fontWeight: 600 }}>{s.present}</span></td>
                    <td><span style={{ color: s.late > 0 ? '#d4a853' : undefined }}>{s.late}</span></td>
                    <td><span style={{ color: s.early > 0 ? '#e8945a' : undefined }}>{s.early}</span></td>
                    <td><span style={{ color: s.absent > 0 ? '#d35a4a' : undefined, fontWeight: s.absent > 0 ? 600 : undefined }}>{s.absent}</span></td>
                    <td>{s.leave}</td>
                    <td>{s.overtimeHrs > 0 ? <strong style={{ color: '#5b7b8c' }}>{s.overtimeHrs}h</strong> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
