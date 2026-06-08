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
      // 只按工号查询，不把明文密码传给数据库过滤
      const { data, error: queryError } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_no', employeeNo)
        .single()

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          setError('员工号不存在')
        } else {
          setError('查询失败: ' + queryError.message)
        }
        setLoading(false)
        return
      }

      // 客户端比对密码（支持明文和 bcrypt 哈希）
      const dbPassword = data.password || ''
      let passwordValid = false

      if (dbPassword.startsWith('$2') && dbPassword.length >= 56) {
        // bcrypt 哈希密码
        const bcryptjs = await import('bcryptjs')
        passwordValid = await bcryptjs.compare(password, dbPassword)
      } else {
        // 明文密码
        passwordValid = (password === dbPassword)
      }

      if (!passwordValid) {
        setError('密码错误')
        setLoading(false)
        return
      }

      // 不把密码暴露到 localStorage
      const { password: _, ...safeUser } = data
      localStorage.setItem('attendance_user', JSON.stringify(safeUser))

      if (safeUser.role === 'admin') {
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
    <div className="login-page">
      <div className="login-card">
        <h1>员工考勤系统</h1>
        <p className="subtitle">请登录您的账号</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>员工号</label>
            <input
              type="text"
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="请输入员工号（如 EMP001）"
              required
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-login">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="test-accounts">
          <p><strong>测试账号</strong></p>
          <p>管理员：ADMIN001 / admin123</p>
          <p>员工：EMP001 / 123456</p>
        </div>
      </div>
    </div>
  )
}
