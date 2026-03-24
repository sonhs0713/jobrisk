import { useState } from 'react'
import Hero from './components/Hero'
import Problem from './components/Problem'
import HowItWorks from './components/HowItWorks'
import Solution from './components/Solution'
import Sample from './components/Sample'
import Pricing from './components/Pricing'
import JobInputForm from './components/JobInputForm'
import FAQ from './components/FAQ'
import Contact from './components/Contact'
import EmailModal from './components/EmailModal'
import Footer from './components/Footer'
import { requestEarlyBirdPayment } from './lib/kcpPayment'

function App() {
  const [isPaying, setIsPaying] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const handlePayClick = () => {
    const problemSection = document.getElementById('problem-section')
    if (!problemSection) return
    problemSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const handleModalClose = () => {
    if (isPaying) return
    setIsModalOpen(false)
  }

  const handleEmailSubmit = async (email) => {
    try {
      setIsPaying(true)
      setUserEmail(email)
      await requestEarlyBirdPayment(email)
    } catch (error) {
      // 토스 결제창 닫기/취소/환경변수 누락 상황을 사용자에게 안내합니다.
      alert(error?.message || '결제 진행 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsPaying(false)
      setIsModalOpen(false)
    }
  }

  const handlePricingClick = () => {
    const jobInputSection = document.getElementById('job-input-section')
    if (!jobInputSection) return
    jobInputSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const handleJobFormPayment = async ({ email, jobPostingText, additionalRequest }) => {
    sessionStorage.setItem('earlybird_job_posting_text', jobPostingText)
    sessionStorage.setItem('earlybird_additional_request', additionalRequest || '')
    setUserEmail(email)

    try {
      setIsPaying(true)
      await requestEarlyBirdPayment(email)
    } catch (error) {
      alert(error?.message || '결제 진행 중 오류가 발생했습니다. 다시 시도해주세요.')
      throw error
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="app-shell">
      <Hero onPayClick={handlePayClick} isPaying={isPaying} />
      <Problem />
      <HowItWorks />
      <Solution />
      <Sample />
      <Pricing onPayClick={handlePricingClick} isPaying={isPaying} />
      <JobInputForm onSubmitPayment={handleJobFormPayment} isPaying={isPaying} />
      <FAQ />
      <Contact />
      <Footer />
      <EmailModal
        isOpen={isModalOpen}
        email={userEmail}
        onEmailChange={setUserEmail}
        onClose={handleModalClose}
        onSubmit={handleEmailSubmit}
        isSubmitting={isPaying}
      />
    </div>
  )
}

export default App

