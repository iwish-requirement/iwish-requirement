import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Briefcase, ArrowRight, Mail, Lock, User, Building2, CheckCircle2 } from 'lucide-react';
import { getDepartments } from '../utils/storage';
import { Department } from '../types';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    setDepartments(getDepartments());
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API submission
    setTimeout(() => {
      setSubmitted(true);
    }, 800);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
           <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
             <CheckCircle2 className="w-10 h-10" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 mb-3">注册申请已提交</h2>
           <p className="text-slate-500 mb-8">
             您的账号申请已发送至管理员。审核通过后，我们将通过邮件通知您。
           </p>
           <Link to="/login" className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors">
             返回登录页
           </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8 md:p-12">
         <div className="flex items-center gap-2 text-slate-900 mb-8 justify-center">
            <Briefcase className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-xl">Nexus</span>
         </div>

         <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">注册新账号</h2>
         <p className="text-slate-500 mb-10 text-center">加入 Nexus，开启高效协作之旅</p>

         <form onSubmit={handleSubmit} className="space-y-5">
           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">真实姓名</label>
             <div className="relative">
               <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input type="text" required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="张三" />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">企业邮箱</label>
             <div className="relative">
               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input type="email" required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="name@company.com" />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">所属部门</label>
             <div className="relative">
               <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <select required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none">
                 <option value="">请选择部门</option>
                 {departments.map(d => (
                   <option key={d.id} value={d.id}>{d.name}</option>
                 ))}
               </select>
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-sm font-bold text-slate-700">密码</label>
             <div className="relative">
               <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input type="password" required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="••••••••" />
             </div>
           </div>

           <button 
             type="submit"
             className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4"
           >
             提交申请 <ArrowRight className="w-5 h-5" />
           </button>
         </form>

         <p className="mt-8 text-center text-slate-500 text-sm">
           已有账号? <Link to="/login" className="text-blue-600 font-bold hover:underline">直接登录</Link>
         </p>
      </div>
    </div>
  );
};

export default Register;
