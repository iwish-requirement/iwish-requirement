// 简单的 toast 实现
class Toast {
  private container: HTMLElement | null = null

  private createContainer() {
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'toast-container'
      this.container.className = 'fixed top-4 right-4 z-50 space-y-2'
      document.body.appendChild(this.container)
    }
    return this.container
  }

  private show(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const container = this.createContainer()
    
    const toast = document.createElement('div')
    toast.className = `
      px-4 py-3 rounded-lg shadow-lg text-white font-medium
      transform transition-all duration-300 translate-x-full opacity-0
      ${type === 'success' ? 'bg-green-500' : ''}
      ${type === 'error' ? 'bg-red-500' : ''}
      ${type === 'info' ? 'bg-blue-500' : ''}
    `
    toast.textContent = message
    
    container.appendChild(toast)
    
    // 动画显示
    setTimeout(() => {
      toast.classList.remove('translate-x-full', 'opacity-0')
    }, 10)
    
    // 自动移除
    setTimeout(() => {
      toast.classList.add('translate-x-full', 'opacity-0')
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast)
        }
      }, 300)
    }, 3000)
  }

  success(message: string) {
    this.show(message, 'success')
  }

  error(message: string) {
    this.show(message, 'error')
  }

  info(message: string) {
    this.show(message, 'info')
  }
}

export const toast = new Toast()