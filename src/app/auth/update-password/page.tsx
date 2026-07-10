'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Password Required', { description: 'Please enter a new password.' });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);

    if (error) {
      toast.error('Failed to update password', { description: error.message });
    } else {
      toast.success('Password updated successfully!');
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">Update Password</CardTitle>
          <CardDescription className="text-zinc-400">Enter your new secure password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="New Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                required
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-white text-black hover:bg-zinc-200 !cursor-pointer"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
