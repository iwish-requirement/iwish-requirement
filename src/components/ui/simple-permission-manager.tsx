'use client'

import React from 'react'
import { Shield, Users, Settings, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const SimplePermissionManager: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总权限数</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              系统: 20 | 自定义: 4
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">角色数量</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              活跃: 3 | 停用: 0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">页面配置</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              动态页面配置数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">评分维度</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              活跃的评分维度
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 功能说明 */}
      <Card>
        <CardHeader>
          <CardTitle>动态权限系统</CardTitle>
          <CardDescription>
            全新的动态权限管理系统已成功部署
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium">权限管理</h4>
                <p className="text-sm text-gray-600">
                  支持层级权限结构，可动态创建、编辑和删除权限
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium">角色配置</h4>
                <p className="text-sm text-gray-600">
                  灵活的角色管理，支持权限组合和动态分配
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Settings className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-medium">页面配置</h4>
                <p className="text-sm text-gray-600">
                  动态页面访问控制，基于权限的路由管理
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <BarChart3 className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium">评分系统</h4>
                <p className="text-sm text-gray-600">
                  可配置的评分维度，支持权重设置和统计分析
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-green-400 text-xl">✅</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  系统部署成功
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>动态权限系统已成功部署并初始化：</p>
                  <ul className="mt-1 list-disc list-inside">
                    <li>数据库迁移完成 (6个迁移文件)</li>
                    <li>权限数据初始化完成</li>
                    <li>RLS安全策略已启用</li>
                    <li>数据库函数已创建</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}