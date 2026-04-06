// ============================================================
// M23 — Pages auth secondaires
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Alert, Card } from '@/components/ui'

// ─── Mot de passe oublié ───────────────────────────────────
export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Réinitialiser le mot de passe</h1>
          <p className="text-sm text-gray-500 mt-1">Un email vous sera envoyé</p>
        </div>
        <Card>
          {sent ? (
            <div className="space-y-4">
              <Alert variant="success" title="Email envoyé">
                Consultez votre boîte mail et suivez les instructions.
              </Alert>
              <Link to="/login">
                <Button variant="secondary" className="w-full">Retour à la connexion</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="danger">{error}</Alert>}
              <Input
                label="Adresse email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="vous@societe.com"
              />
              <Button type="submit" className="w-full" loading={loading}>
                Envoyer le lien
              </Button>
              <Link to="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700">
                Retour à la connexion
              </Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

// ─── Accès non autorisé ────────────────────────────────────
export function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl font-bold text-gray-200">403</div>
        <h1 className="text-xl font-semibold text-gray-800">Accès non autorisé</h1>
        <p className="text-gray-500 text-sm">Votre rôle ne vous permet pas d'accéder à cette page.</p>
        <Link to="/dashboard">
          <Button variant="secondary">Retour au tableau de bord</Button>
        </Link>
      </div>
    </div>
  )
}

// ─── Compte en attente de configuration ───────────────────
export function PendingSetupPage() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-warning-600 text-xl">⏳</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Compte en attente</h1>
        <p className="text-sm text-gray-500">
          Votre compte n'est pas encore associé à une société. Contactez votre administrateur pour finaliser la configuration.
        </p>
        <Button variant="secondary" onClick={signOut}>Se déconnecter</Button>
      </Card>
    </div>
  )
}
