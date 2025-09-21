import { render, screen } from '@testing-library/react'

// Simple component test to verify Jest setup
function SimpleComponent() {
  return <div>Hello Test World</div>
}

describe('Simple Component Test', () => {
  it('renders simple component correctly', () => {
    render(<SimpleComponent />)
    expect(screen.getByText('Hello Test World')).toBeInTheDocument()
  })

  it('verifies Jest and React Testing Library are working', () => {
    expect(true).toBe(true)
  })
})