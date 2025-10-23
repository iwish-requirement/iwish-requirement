'use client'

import { useCallback } from 'react'

// 全局导航刷新事件管理
class NavigationRefreshManager {
  private listeners: Set<() => void> = new Set()

  subscribe(callback: () => void) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  refresh() {
    this.listeners.forEach(callback => callback())
  }
}

export const navigationRefreshManager = new NavigationRefreshManager()

export function useNavigationRefresh() {
  const triggerRefresh = useCallback(() => {
    navigationRefreshManager.refresh()
  }, [])

  return { triggerRefresh }
}