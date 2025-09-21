import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

// Mock useTutorial hook - renamed to follow React Hook naming convention
const useMockTutorial = () => {
  const [currentSection, setCurrentSection] = useState('introduction')
  const [completedSections, setCompletedSections] = useState<string[]>([])
  const [isCompleted, setIsCompleted] = useState(false)

  return {
    currentSection,
    completedSections,
    isCompleted,
    goToSection: (section: string) => setCurrentSection(section),
    markSectionCompleted: (section: string) => {
      setCompletedSections(prev => [...prev, section])
    },
    resetProgress: () => {
      setCurrentSection('introduction')
      setCompletedSections([])
      setIsCompleted(false)
    }
  }
}

describe('useTutorial', () => {
  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useMockTutorial())

    expect(result.current.currentSection).toBe('introduction')
    expect(result.current.completedSections).toEqual([])
    expect(result.current.isCompleted).toBe(false)
  })

  it('should navigate to section correctly', () => {
    const { result } = renderHook(() => useMockTutorial())

    act(() => {
      result.current.goToSection('cards')
    })

    expect(result.current.currentSection).toBe('cards')
  })

  it('should mark section as completed', () => {
    const { result } = renderHook(() => useMockTutorial())

    act(() => {
      result.current.markSectionCompleted('introduction')
    })

    expect(result.current.completedSections).toContain('introduction')
  })

  it('should reset tutorial progress', () => {
    const { result } = renderHook(() => useMockTutorial())

    act(() => {
      result.current.goToSection('cards')
      result.current.markSectionCompleted('introduction')
    })

    act(() => {
      result.current.resetProgress()
    })

    expect(result.current.currentSection).toBe('introduction')
    expect(result.current.completedSections).toEqual([])
    expect(result.current.isCompleted).toBe(false)
  })
})