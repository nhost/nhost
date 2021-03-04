import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FiMoon } from 'react-icons/fi'
import ToggleIconButton from '@components/toggleIconButton/ToggleIconButton'

describe('Toggle Icon Button', () => {
  it('should call "toggle" when the user clicks on the icon', () => {
    const toggleMock = jest.fn()

    const { getByRole } = render(
      <ToggleIconButton toggle={toggleMock} icon={<FiMoon />} aria-label="Toggle Icon Button" />
    )
    userEvent.click(getByRole('button'))
    expect(toggleMock).toBeCalledTimes(1)
  })
})
