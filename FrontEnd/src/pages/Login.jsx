import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, Settings } from 'lucide-react';
import { API_URL } from "../api/config"; 
const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('${API_URL}/auth/login', {
        username,
        password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('userRole', response.data.role); 
        localStorage.setItem('userPermissions', JSON.stringify(response.data.permissions || {})); 
        localStorage.setItem('username', username);
        
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0B132B] font-sans overflow-hidden">
      
      {/* LEFT SIDE: BRANDING & ANIMATED INDUSTRIAL EFFECT */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-[#0B132B] via-[#0F1C3F] to-[#064E3B]/40 border-r border-slate-800/80 relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-xl shadow-lg">E</div>
          <span className="font-bold text-white text-lg tracking-wider">Elisha <span className="text-emerald-400">ERP</span>
          </span>
        </div>

        {/* CENTERED CONTENT CONTAINER */}
        <div className="flex flex-col items-center text-center space-y-8 max-w-lg mx-auto my-auto">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
              Welcome to Elisha Clothing
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed max-w-md">
              The next-generation platform for industrial garment manufacturing, inventory tracking, and resource planning.
            </p>
          </div>

          {/* 🌟 ANIMATED INDUSTRIAL GEARS / PULSE GRAPHIC */}
          <div className="relative flex items-center justify-center py-6">
            {/* Glowing background aura */}
            <div className="absolute w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl animate-pulse"></div>
            
            {/* Rotating Gears Animation Container */}
            <div className="relative z-10 flex items-center gap-4 p-5 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-emerald-500/30 shadow-2xl">
              <Settings className="text-emerald-400 animate-spin" size={36} style={{ animationDuration: '8s' }} />
              <div className="text-left">
                <div className="text-white font-bold text-sm tracking-wide">Garment Automation Live</div>
                <div className="text-emerald-400 text-xs font-mono">BOM • Production • GRN • Stock</div>
              </div>
              <Settings className="text-emerald-500 animate-spin" size={24} style={{ animationDirection: 'reverse', animationDuration: '6s' }} />
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          © 2026 Green Systems. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE: MODERN LOGIN FORM CARD */}
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 p-8 bg-[#0B132B]">
        <div className="w-full max-w-md p-8 bg-[#111C3A] rounded-2xl border border-slate-800 shadow-2xl space-y-6 backdrop-blur-md">
          
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-xl mx-auto shadow-md lg:hidden">G</div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p className="text-xs text-slate-400">Enter your credentials to access your dashboard control panel</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-lg text-xs font-medium animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wider">Username</label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full pl-11 pr-4 py-3 bg-[#0B132B] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wider">Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 text-slate-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-10 py-3 bg-[#0B132B] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-200 cursor-pointer bg-transparent border-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input type="checkbox" className="rounded bg-[#0B132B] border-slate-700 text-emerald-600 focus:ring-0" />
                <span>Remember me</span>
              </label>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Please contact system Administrator to reset your password."); }} className="text-emerald-400 hover:underline font-medium">
                Forgot password?
              </a>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg cursor-pointer border-none mt-2"
            >
              {loading ? <Loader2 className="animate-spin text-white" size={16} /> : 'Sign In to Account'}
            </button>

          </form>

        </div>
      </div>

    </div>
  );
};

export default Login;