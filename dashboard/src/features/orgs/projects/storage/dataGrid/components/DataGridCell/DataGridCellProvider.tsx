import type { RefObject, PropsWithChildren } from 'react'
import { createContext, useMemo, useReducer, useRef } from 'react'

export interface DataGridCellContextProps<T = HTMLElement> {
  /**
   * This `ref` should be attached to the cell element.
   */
  cellRef: RefObject<HTMLDivElement | null>
  /**
   * This `ref` should be attached to the input element inside the data grid cell.
   */
  inputRef: RefObject<T | null>
  /**
   * Determines whether or not the cell is currently being edited.
   */
  isEditing: boolean
  /**
   * Determines whether or not the cell is currently selected.
   */
  isSelected: boolean
  /**
   * Function to be called to start editing.
   */
  editCell: VoidFunction
  /**
   * Function to be called to cancel editing.
   */
  cancelEditCell: VoidFunction
  /**
   * Function to be called to select the cell, but not start editing.
   */
  selectCell: VoidFunction
  /**
   * Function to be called to deselect cell and cancel editing.
   */
  deselectCell: VoidFunction
  /**
   * Function to be called to focus cell.
   */
  focusCell: () => Promise<void>
  /**
   * Function to be called to blur cell.
   */
  blurCell: () => Promise<void>
  /**
   * Function to be called to programatically focus the input in the cell.
   */
  focusInput: () => Promise<void>
  /**
   * Function to be called to programatically blur the input in the cell.
   */
  blurInput: () => Promise<void>
  /**
   * Function to be called to programmatically click the input in the cell.
   */
  clickInput: () => Promise<void>
  /**
   * Function to be called to navigate to next cell if available.
   *
   * @returns `true` if there is a next cell to focus, `false` otherwise.
   */
  focusNextCell: () => boolean
  /**
   * Function to be called to navigate to previous cell if available.
   *
   * @returns `true` if there is a previous cell to focus, `false` otherwise.
   */
  focusPrevCell: () => boolean
}

export const DataGridCellContext = createContext<DataGridCellContextProps | null>(null)

interface EditAndSelectState {
  isEditing: boolean
  isSelected: boolean
}

type EditAndSelectAction =
  | { type: 'EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SELECT' }
  | { type: 'DESELECT' }

function editAndSelectCellReducer(
  state: EditAndSelectState,
  action: EditAndSelectAction
): EditAndSelectState {
  switch (action.type) {
    case 'EDIT':
      return { ...state, isEditing: true, isSelected: true }
    case 'CANCEL_EDIT':
      return { ...state, isEditing: false }
    case 'SELECT':
      return { ...state, isSelected: true }
    case 'DESELECT':
      return { ...state, isEditing: false, isSelected: false }
    default:
      return { ...state }
  }
}

export default function DataGridCellProvider<TInput extends HTMLElement>({
  children
}: PropsWithChildren<unknown>) {
  const cellRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<TInput>(null)
  const [{ isEditing, isSelected }, dispatch] = useReducer(editAndSelectCellReducer, {
    isEditing: false,
    isSelected: false
  })

  const value: DataGridCellContextProps<HTMLElement> = useMemo(
    () => ({
      focusCell() {
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            cellRef.current?.focus()

            resolve()
          })
        })
      },
      blurCell() {
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            cellRef.current?.blur()

            resolve()
          })
        })
      },
      focusInput() {
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            inputRef.current?.focus()

            resolve()
          })
        })
      },
      blurInput() {
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            inputRef.current?.blur()

            resolve()
          })
        })
      },
      clickInput() {
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            inputRef.current?.click()

            resolve()
          })
        })
      },
      isEditing,
      isSelected,
      editCell() {
        dispatch({ type: 'EDIT' })
      },
      cancelEditCell() {
        dispatch({ type: 'CANCEL_EDIT' })
      },
      selectCell() {
        dispatch({ type: 'SELECT' })
      },
      deselectCell() {
        dispatch({ type: 'DESELECT' })
      },
      cellRef,
      inputRef,
      focusPrevCell() {
        const prevCellAvailable =
          cellRef.current?.previousElementSibling instanceof HTMLElement &&
          cellRef.current?.previousElementSibling.tabIndex > -1

        requestAnimationFrame(() => {
          if (prevCellAvailable) {
            ;(cellRef.current?.previousElementSibling as HTMLElement).focus()
            dispatch({ type: 'DESELECT' })
          }
        })

        return prevCellAvailable
      },
      focusNextCell() {
        const nextCellAvailable =
          cellRef.current?.nextElementSibling instanceof HTMLElement &&
          cellRef.current?.nextElementSibling.tabIndex > -1

        requestAnimationFrame(() => {
          if (nextCellAvailable) {
            ;(cellRef.current?.nextElementSibling as HTMLElement).focus()
            dispatch({ type: 'DESELECT' })
          }
        })

        return nextCellAvailable
      }
    }),
    [isEditing, isSelected]
  )

  return <DataGridCellContext.Provider value={value}>{children}</DataGridCellContext.Provider>
}
