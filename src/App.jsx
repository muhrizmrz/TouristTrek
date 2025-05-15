import { useState } from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import AppRoutes from './AppRoutes'
import Header from './components/Header'

function App() {
  return (
    <Router>
      <Header />
      <AppRoutes />
    </Router>
  )
}

export default App
