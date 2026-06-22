import { NavLink } from 'react-router-dom'

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">⏱</span>
        <span className="bottom-nav__label">计时</span>
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">📊</span>
        <span className="bottom-nav__label">统计</span>
      </NavLink>
      <NavLink to="/records" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">📋</span>
        <span className="bottom-nav__label">记录</span>
      </NavLink>
    </nav>
  )
}
