import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Briefcase, ArrowRight, Mail, Lock } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistrationAllowed, setIsRegistrationAllowed] = useState(false);

  useEffect(() => {
    const allowed = localStorage.getItem('registrationEnabled') === 'true';
    setIsRegistrationAllowed(allowed);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      window.location.reload(); // Reload to trigger App auth check
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex">
        
        {/* Left Side - Visual */}
        <div className="hidden md:flex w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
           <div className="relative z-10">
             <div className="flex items-center gap-3 text-white mb-10">
                <Briefcase className="w-8 h-8 text-blue-500" />
                <span className="font-bold text-2xl tracking-tight">Nexus</span>
             </div>
             <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
               企业级<br/>内部需求管理系统
             </h1>
             <p className="text-slate-400 text-lg leading-relaxed">
               高效协同，数据驱动。连接产品、研发与市场，让每一个需求都能精准落地。
             </p>
           </div>
           <div className="relative z-10 text-sm text-slate-600">
             &copy; 2023 Nexus Corp. All rights reserved.
           </div>

           {/* Background Elements */}
           <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
           <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-purple-600 rounded-full blur-[80px] opacity-20"></div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center">
           <div className="md:hidden flex items-center gap-2 text-slate-900 mb-8">
              <Briefcase className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-xl">Nexus</span>
           </div>

           <h2 className="text-2xl font-bold text-slate-900 mb-2">欢迎回来</h2>
           <p className="text-slate-500 mb-10">请输入您的账号信息以继续访问</p>

           <form onSubmit={handleLogin} className="space-y-6">
             <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700">企业邮箱</label>
               <div className="relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <input 
                   type="email" 
                   required
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                   placeholder="name@company.com"
                 />
               </div>
             </div>

             <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">密码</label>
                  <a href="#" className="text-xs font-medium text-blue-600 hover:underline">忘记密码?</a>
               </div>
               <div className="relative">
                 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <input 
                   type="password" 
                   required
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                   placeholder="••••••••"
                 />
               </div>
             </div>

             <button 
               type="submit"
               disabled={isLoading}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
             >
               {isLoading ? '登录中...' : (
                 <>登录 <ArrowRight className="w-5 h-5" /></>
               )}
             </button>
           </form>

           {isRegistrationAllowed && (
             <p className="mt-8 text-center text-slate-500 text-sm">
               还没有账号? <Link to="/register" className="text-blue-600 font-bold hover:underline">立即注册</Link>
             </p>
           )}
        </div>
      </div>
    </div>
  );
};

export default Login;