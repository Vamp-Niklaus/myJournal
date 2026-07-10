'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, FolderOpen, Mail } from 'lucide-react';
import { DailyDiary } from '@/components/modules/DailyDiary';
import { AssetOrganizer } from '@/components/modules/AssetOrganizer';

import { Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const activeModule = searchParams.get('tab') === 'organizer' ? 'organizer' : 'diary';

  const setActiveModule = (module: 'diary' | 'organizer') => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('tab', module);
    // When switching to organizer, default to root if no folder is set
    if (module === 'organizer' && !current.has('folder')) {
      current.set('folder', 'root');
    }
    router.push(`${pathname}?${current.toString()}`);
  };

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.type === 'cancelation') {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) alert(error.message);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
    } else {
      setIsAwaitingConfirmation(true);
      setResendTimer(120);
    }
  };

  const handleResendEmail = async () => {
    if (resendTimer > 0) return;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) {
      alert(error.message);
    } else {
      setResendTimer(120);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      alert('Please enter your email address first.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) alert(error.message);
    else alert('Password reset instructions sent to your email!');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white shadow-2xl">
          {isAwaitingConfirmation ? (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-zinc-400" />
                </div>
                <CardTitle className="text-2xl font-semibold tracking-tight">Check your email</CardTitle>
                <CardDescription className="text-zinc-400 pt-2">
                  We sent a confirmation link to <strong className="text-white">{email}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <Button 
                  onClick={handleResendEmail} 
                  disabled={resendTimer > 0}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {resendTimer > 0 ? `Resend email in ${Math.floor(resendTimer / 60)}:${(resendTimer % 60).toString().padStart(2, '0')}` : 'Resend Email'}
                </Button>
                <div className="flex justify-center pt-2">
                  <button type="button" onClick={() => setIsAwaitingConfirmation(false)} className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Back to login
                  </button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {isForgotPassword ? 'Reset Password' : isSignUpMode ? 'Create an Account' : 'Welcome to MyJournal'}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  {isForgotPassword ? 'Enter your email to receive a reset link.' : isSignUpMode ? 'Sign up to start organizing your links and notes.' : 'Enter your email to sign in to your account.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  {isForgotPassword ? (
                    <>
                      <div className="space-y-2">
                        <Input 
                          type="email" 
                          placeholder="Enter your email to reset password" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-white"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-3 pt-2">
                        <Button onClick={handleResetPassword} className="w-full bg-white text-black hover:bg-zinc-200">Send Reset Link</Button>
                        <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-zinc-400 hover:text-white transition-colors">Back to login</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Input 
                          type="email" 
                          placeholder="Email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Input 
                          type="password" 
                          placeholder="Password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                      {!isSignUpMode && (
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-zinc-400 hover:text-white transition-colors">Forgot Password?</button>
                        </div>
                      )}
                      <div className="flex flex-col gap-3 pt-2">
                        {isSignUpMode ? (
                          <Button onClick={handleSignUp} className="w-full bg-white text-black hover:bg-zinc-200">Create Account</Button>
                        ) : (
                          <Button onClick={handleSignIn} className="w-full bg-white text-black hover:bg-zinc-200">Sign In</Button>
                        )}
                      </div>
                      <div className="flex justify-center mt-2">
                        <button 
                          type="button" 
                          onClick={() => setIsSignUpMode(!isSignUpMode)} 
                          className="text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          {isSignUpMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </button>
                      </div>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-zinc-900 px-2 text-zinc-500">Or continue with</span>
                        </div>
                      </div>
                      <Button type="button" onClick={handleGoogleSignIn} variant="outline" className="w-full border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white">
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          <path d="M1 1h22v22H1z" fill="none" />
                        </svg>
                        Google
                      </Button>
                    </>
                  )}
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col overflow-hidden">
      {/* Top Navigation / Toggle */}
      <header className="flex-none h-16 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between px-2 md:px-6 z-10 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <div className="text-sm font-medium bg-zinc-900 p-1 rounded-full flex relative">
            {/* Animated background pill */}
            <motion.div
              className="absolute inset-y-1 bg-zinc-800 rounded-full"
              layoutId="activeTabIndicator"
              initial={false}
              animate={{
                width: activeModule === 'diary' ? '100px' : '110px',
                x: activeModule === 'diary' ? 0 : 100,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            
            <button
              onClick={() => setActiveModule('diary')}
              className={`relative z-10 flex cursor-pointer items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${activeModule === 'diary' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              style={{ width: '100px' }}
            >
              <CalendarDays className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Diary
            </button>
            <button
              onClick={() => setActiveModule('organizer')}
              className={`relative z-10 flex cursor-pointer items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${activeModule === 'organizer' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              style={{ width: '110px' }}
            >
              <FolderOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Organizer
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 ml-4">
          <span className="text-xs md:text-sm text-zinc-400 hidden sm:inline-block truncate max-w-[150px] md:max-w-xs">{session.user.email}</span>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()} className="text-zinc-400 hover:text-white px-2 md:px-3">
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">Exit</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area with Slider Animation */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={activeModule}>
          <motion.div
            key={activeModule}
            custom={activeModule}
            initial={{ opacity: 0, x: activeModule === 'diary' ? -100 : 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeModule === 'diary' ? 100 : -100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 h-full w-full"
          >
            {activeModule === 'diary' ? (
              <div className="h-full w-full p-6">
                <h2 className="text-2xl font-bold mb-4">Daily Diary</h2>
                <DailyDiary />
              </div>
            ) : (
              <div className="h-full w-full p-6">
                <h2 className="text-2xl font-bold mb-4">Asset Organizer</h2>
                <AssetOrganizer />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading App...</div>}>
      <AppContent />
    </Suspense>
  );
}
