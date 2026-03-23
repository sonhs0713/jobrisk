import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ThankYou from './pages/ThankYou.jsx'
import PaymentFail from './pages/PaymentFail.jsx'
import PaymentComplete from './pages/PaymentComplete.jsx'
import Terms from './pages/Terms.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/payment-complete" element={<PaymentComplete />} />
      <Route path="/thank-you" element={<ThankYou />} />
      <Route path="/payment-fail" element={<PaymentFail />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>,
)
