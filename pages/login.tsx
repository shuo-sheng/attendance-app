import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [employeeNo, setEmployeeNo] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('attendance_user')
    if (user) {
      const parsed = JSON.parse(user)
      if (parsed.role === 'admin') {
        router.push('/')
      } else {
        router.push('/employee')
      }
    }
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: queryError } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_no', employeeNo)
        .eq('password', password)
        .single()

      if (queryError || !data) {
        setError('员工号或密码错误')
        setLoading(false)
        return
      }

      localStorage.setItem('attendance_user', JSON.stringify(data))
      
      if (data.role === 'admin') {
        router.push('/')
      } else {
        router.push('/employee')
      }
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🔐 员工考勤系统</h1>
          <p className="text-gray-500 mt-2">请登录您的账号</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">员工号</label>
            <input
              type="text"
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="请输入员工号（如 EMP001）"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>测试账号：</p>
          <p className="mt-1">管理员：ADMIN001 / admin123</p>
          <p>员工：EMP001 / 123456</p>
        </div>
      </div>
    </div>
  )
}
