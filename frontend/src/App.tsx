import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from './api/hooks/useAuth'
import { getAccessToken } from './api/client'
import { hasWelcomed } from './lib/personalization'
import { BreathingLoader } from './components/BreathingLoader'
import LoginScreen from './screens/auth/LoginScreen'
import RegisterScreen from './screens/auth/RegisterScreen'
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import HomeScreen from './screens/HomeScreen'
import ChallengeBrowseScreen from './screens/ChallengeBrowseScreen'
import ChallengeDetailScreen from './screens/ChallengeDetailScreen'
import ChallengeCompleteScreen from './screens/ChallengeCompleteScreen'
import CelebrationScreen from './screens/CelebrationScreen'
import SenseiChatScreen from './screens/SenseiChatScreen'
import ProfileScreen from './screens/ProfileScreen'
import PathScreen from './screens/PathScreen'
import SettingsScreen from './screens/SettingsScreen'

const ONBOARDED_KEY = 'seynsei.onboarded'

function isAuthed(): boolean {
  return getAccessToken() !== null
}

function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === 'true'
}

function RequireAuth() {
  const me = useCurrentUser()
  if (!isAuthed()) return <Navigate to="/auth/login" replace />
  if (me.isLoading) return <BreathingLoader />
  if (me.isError) return <Navigate to="/auth/login" replace />
  return <Outlet />
}

function RequireOnboarded() {
  if (!isOnboarded()) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function RedirectIfAuthed() {
  if (isAuthed()) return <Navigate to="/home" replace />
  return <Outlet />
}

// Unauthenticated landing: first-time visitors see the welcome flow, returning
// guests drop straight into the (guest-browsable) challenge catalog.
function RootRedirect() {
  if (isAuthed()) return <Navigate to="/home" replace />
  return <Navigate to={hasWelcomed() ? '/challenges' : '/welcome'} replace />
}

// /welcome is a pre-register flow; if already authed there's nothing to do.
function WelcomeRoute() {
  if (isAuthed()) return <Navigate to="/home" replace />
  return <WelcomeScreen />
}

function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthed />}>
        <Route path="/auth/login" element={<LoginScreen />} />
        <Route path="/auth/register" element={<RegisterScreen />} />
        <Route path="/auth/forgot" element={<ForgotPasswordScreen />} />
      </Route>

      <Route path="/welcome" element={<WelcomeRoute />} />

      {/* Guest-browsable catalog — renders with or without auth. The screens
          themselves branch on auth for user-specific pieces + locked CTAs. */}
      <Route path="/challenges" element={<ChallengeBrowseScreen />} />
      <Route path="/challenges/:id" element={<ChallengeDetailScreen />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingScreen />} />

        <Route element={<RequireOnboarded />}>
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/challenges/:id/complete" element={<ChallengeCompleteScreen />} />
          <Route path="/celebration" element={<CelebrationScreen />} />
          <Route path="/sensei" element={<SenseiChatScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/path" element={<PathScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

export default App
