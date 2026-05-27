import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateMe, changePassword } from '../../api/auth.js'
import useAuthStore from '../../store/authStore.js'

export default function EditProfileModal({ onClose }) {
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore((s) => ({ user: s.user, setUser: s.setUser }))

  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountMsg, setAccountMsg] = useState('')

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  const handleSaveAccount = async () => {
    setAccountSaving(true)
    setAccountMsg('')
    try {
      const res = await updateMe({ username, email })
      setUser(res.data)
      setAccountMsg(t('profile.accountSaved'))
      setTimeout(() => setAccountMsg(''), 2000)
    } catch (err) {
      const detail = err?.response?.data
      if (detail?.username) {
        setAccountMsg(t('profile.usernameTaken'))
      } else {
        setAccountMsg(t('profile.accountError'))
      }
    } finally {
      setAccountSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) {
      setPwdMsg(t('auth.passwordMismatch'))
      return
    }
    setPwdSaving(true)
    setPwdMsg('')
    try {
      await changePassword({ current_password: currentPwd, new_password: newPwd, new_password2: confirmPwd })
      setPwdMsg(t('profile.passwordChanged'))
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setTimeout(() => setPwdMsg(''), 3000)
    } catch (err) {
      const detail = err?.response?.data
      if (detail?.current_password) {
        setPwdMsg(t('profile.wrongPassword'))
      } else if (detail?.new_password) {
        setPwdMsg(detail.new_password[0] ?? t('profile.passwordError'))
      } else {
        setPwdMsg(t('profile.passwordError'))
      }
    } finally {
      setPwdSaving(false)
    }
  }

  const isAccountChanged = username !== (user?.username ?? '') || email !== (user?.email ?? '')
  const isPwdReady = currentPwd && newPwd && confirmPwd

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ width: 520, maxWidth: '92vw', padding: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>{t('profile.accountEyebrow')}</div>
            <div className="modal-title" style={{ margin: 0 }}>{t('profile.accountTitle')}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em',
              color: 'var(--moss)', textTransform: 'uppercase', paddingTop: 4,
            }}
          >
            ✕ {t('sessions.cancel')}
          </button>
        </div>

        {/* Account section */}
        <div style={{ marginBottom: 32 }}>
          <div className="form-group">
            <label className="form-label">{t('profile.usernameLabel')}</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('profile.emailLabel')}</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button
              className="btn btn--primary"
              onClick={handleSaveAccount}
              disabled={accountSaving || !isAccountChanged}
            >
              {accountSaving ? t('profile.savingAccount') : t('profile.saveAccount')}
            </button>
            {accountMsg && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em',
                color: accountMsg === t('profile.accountSaved') ? 'var(--moss-pale)' : 'var(--blood-bright)',
              }}>
                {accountMsg}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--ochre-deep)', marginBottom: 28 }} />

        {/* Password section */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>{t('profile.securityEyebrow')}</div>
          <div className="form-group">
            <label className="form-label">{t('profile.currentPassword')}</label>
            <input
              className="form-input"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">{t('profile.newPassword')}</label>
              <input
                className="form-input"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.confirmPassword')}</label>
              <input
                className="form-input"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button
              className="btn btn--primary"
              onClick={handleChangePassword}
              disabled={pwdSaving || !isPwdReady}
            >
              {pwdSaving ? t('profile.changingPassword') : t('profile.changePassword')}
            </button>
            {pwdMsg && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em',
                color: pwdMsg === t('profile.passwordChanged') ? 'var(--moss-pale)' : 'var(--blood-bright)',
              }}>
                {pwdMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
