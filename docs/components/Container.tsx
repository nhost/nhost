export function Container({ children }) {
  return (
    <div className="mx-10 px-2 sm:px-10 md:px-20 lg:px-0 flex flex-row md:max-w-container pb-20 md:mx-auto mt-8 lg:space-x-20">
      {children}
    </div>
  )
}
