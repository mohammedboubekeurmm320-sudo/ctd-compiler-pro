// ============================================================
// M23 — Page Login (VERSION DÉBOGAGE)
// ============================================================

import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Alert, Card } from '@/components/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔥 1. Formulaire soumis')
    
    setError('')
    setLoading(true)
    console.log('🔥 2. Loading activé')

    try {
      console.log('🔥 3. Avant signIn - email:', email)
      await signIn(email, password)
      console.log('🔥 4. signIn réussi !')
      
      console.log('🔥 5. Avant navigation vers:', from)
      navigate(from, { replace: true })
      console.log('🔥 6. Navigation appelée')
      
    } catch (err) {
      console.error('🔥 ERREUR attrapée:', err)
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      console.log('🔥 7. Finally - loading désactivé')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-4">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">CTD Compiler Pro</h1>
          <p className="text-sm text-gray-500 mt-1">Connexion à votre espace de travail</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="danger">{error}</Alert>}

            <Input
              label="Adresse email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="vous@societe.com"
            />

            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
                Mot de passe oublié ?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-gray-400">
          CTD Compiler Pro · Conforme ICH M4 · 21 CFR Part 11
        </p>
      </div>
    </div>
  )
}
