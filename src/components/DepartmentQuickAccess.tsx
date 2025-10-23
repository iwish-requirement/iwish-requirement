'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building, 
  ArrowRight, 
  Users, 
  FileText,
  TrendingUp,
  Clock
} from 'lucide-react'
import { departmentService, type Department } from '@/services/department'
import Link from 'next/link'

interface DepartmentStats {
  total: number
  pending: number
  completed: number
  in_progress: number
}

interface DepartmentQuickAccessProps {
  className?: string
}

export function DepartmentQuickAccess({ className }: DepartmentQuickAccessProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentStats, setDepartmentStats] = useState<Record<string, DepartmentStats>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const departmentsData = await departmentService.getDepartments()
        setDepartments(departmentsData)
        
        // 这里可以加载每个部门的统计数据
        // 暂时使用模拟数据
        const mockStats: Record<string, DepartmentStats> = {}
        departmentsData.forEach(dept => {
          mockStats[dept.code] = {
            total: Math.floor(Math.random() * 50) + 10,
            pending: Math.floor(Math.random() * 15) + 2,
            completed: Math.floor(Math.random() * 20) + 5,
            in_progress: Math.floor(Math.random() * 10) + 1
          }
        })
        setDepartmentStats(mockStats)
      } catch (error) {
        console.error('加载部门数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const getDepartmentIcon = (departmentCode: string) => {
    const iconMap: Record<string, any> = {
      'creative': '🎨',
      'tech': '💻',
      'marketing': '📢',
      'hr': '👥',
      'finance': '💰',
      'operations': '⚙️',
      'sales': '📈',
      'support': '🎧',
      'legal': '⚖️',
      'admin': '🏢'
    }
    
    return iconMap[departmentCode] || '🏢'
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>部门快速访问</CardTitle>
          <CardDescription>正在加载部门信息...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building className="h-5 w-5" />
          <span>部门快速访问</span>
        </CardTitle>
        <CardDescription>
          快速访问各部门的专属需求管理页面
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {departments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>暂无部门数据</p>
          </div>
        ) : (
          departments.map(department => {
            const stats = departmentStats[department.code] || { total: 0, pending: 0, completed: 0, in_progress: 0 }
            
            return (
              <Link 
                key={department.id} 
                href={`/dashboard/requirements/${department.code}`}
                className="block"
              >
                <Card className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">
                          {getDepartmentIcon(department.code)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{department.name}</h4>
                          <p className="text-sm text-gray-500">{department.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              {stats.total}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-orange-600">
                              <Clock className="h-3 w-3 mr-1" />
                              {stats.pending}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-green-600">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {stats.completed}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
        
        {departments.length > 0 && (
          <div className="pt-3 border-t">
            <Link href="/dashboard/requirements/department-setup">
              <Button variant="outline" size="sm" className="w-full">
                <Building className="mr-2 h-4 w-4" />
                管理部门导航
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}