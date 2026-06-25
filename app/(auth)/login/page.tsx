'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supabaseAvailable, setSupabaseAvailable] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Detect if Supabase is configured by trying to import the client
    import('@/lib/supabase/client').then(
      () => setSupabaseAvailable(true),
      () => setSupabaseAvailable(false)
    )
  }, [])

  const handleDevBypass = () => {
    router.push('/tasks')
  }

  const handleSSOLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
        },
      })
      if (error) setError(error.message)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/tasks')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (supabaseAvailable === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">VA Management</CardTitle>
          <CardDescription>Sign in to manage your virtual assistants</CardDescription>
        </CardHeader>
        <CardContent>
          {!supabaseAvailable ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Supabase not configured. Use dev bypass to skip authentication.
              </p>
              <Button onClick={handleDevBypass} className="w-full">
                Enter Dashboard (Dev Mode)
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="manager">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manager">Manager</TabsTrigger>
                <TabsTrigger value="va">VA Login</TabsTrigger>
              </TabsList>

              <TabsContent value="manager" className="pt-4">
                <Button
                  onClick={handleSSOLogin}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? 'Redirecting...' : 'Sign in with Google Workspace'}
                </Button>
              </TabsContent>

              <TabsContent value="va" className="pt-4">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
